// Project board scoping: which projects this role sees, who can be assigned,
// and which client accounts are linked to a project.
export const projectsComputed = {
        // A Project Activity is only valid for the board when its Client Directory
        // record is an active Client Task parent. This single gate is used by both
        // the board and list views so an orphaned/legacy record can never appear
        // under an unrelated company's Client Task group.
        registeredClientTaskIds() {
            return new Set(this.customers
                .filter(customer => customer?.id && customer.clientTaskCreatedAt)
                .map(customer => String(customer.id)));
        },
        // Projects in which the signed-in staff member is the assignee of at least
        // one Project Activity. They are not the PIC, so ownerEmail never matches —
        // this is what lets them open the project and read their own scheduled work
        // (see the activityAssigneeEmails branch in the projects rule).
        assignedActivityProjectIds() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            if (!email || this.userProfile.role === 'Client') return new Set();
            return new Set(this.projectActivities
                .filter(activity => String(activity.assignedEmail || '').trim().toLowerCase() === email)
                .map(activity => String(activity.projectId || ''))
                .filter(Boolean));
        },
        filteredProjects() {
            const queryText = this.searchQuery.trim().toLowerCase();
            let records = this.projects
                .filter(project => this.isProjectLinkedToRegisteredClientTask(project))
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
            // Director and Superadmin supervise every Client Task and Project
            // Activity. Every other internal role is deliberately limited to the
            // projects for which they are the assigned PIC; this mirrors the
            // Firestore query/rule below, so changing the visual scope cannot
            // reveal another employee's work.
            const mustUseAssignedScope = this.userProfile.role !== 'Client' && !this.canManageProjects;
            if ((mustUseAssignedScope || this.projectScopeFilter === 'mine') && this.userProfile.role !== 'Client') {
                const email = String(this.userProfile.email || '').trim().toLowerCase();
                // "Mine" is both PIC assignments and projects holding an activity
                // assigned to this employee — the same two sets Firestore returns
                // for a non-manager, so the visual scope can never widen access.
                records = records.filter(project =>
                    String(project.ownerEmail || '').trim().toLowerCase() === email ||
                    this.assignedActivityProjectIds.has(project.id));
            }
            if (this.boardClientFilter) records = records.filter(project => project.clientDirectoryId === this.boardClientFilter.id);
            if (!queryText) return records;
            return records.filter(project => [project.projectRef, project.title, project.clientName, project.ownerName, project.status, project.description].some(value => String(value || '').toLowerCase().includes(queryText)));
        },
        projectClientAccessUsers() {
            const clientUsers = this.users.filter(user => user.role === 'Client' && String(user.email || '').trim());
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            if (!customer) return clientUsers.sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
            const authorizedEmails = new Set([
                customer.clientEmail,
                ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
            ].map(email => String(email || '').trim().toLowerCase()).filter(Boolean));
            return clientUsers
                .filter(user => authorizedEmails.has(String(user.email || '').trim().toLowerCase()))
                .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
        },
        unlinkedProjectClientEmails() {
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            if (!customer) return [];
            const portalEmails = new Set(this.users
                .filter(user => user.role === 'Client')
                .map(user => String(user.email || '').trim().toLowerCase())
                .filter(Boolean));
            return [...new Set([
                customer.clientEmail,
                ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])
            ].map(email => String(email || '').trim().toLowerCase()).filter(Boolean))]
                .filter(email => !portalEmails.has(email));
        },
        // Among unlinkedProjectClientEmails, flag the ones that can NEVER become a
        // Client Portal account under that exact address because a non-Client
        // (staff) account already owns it — staff accounts must use one of the
        // approved company domains. createUserWithEmailAndPassword always hits
        // auth/email-already-in-use for these, and the pending_access fallback
        // (savePortalUser) never activates because that uid's users/{uid} doc
        // already exists (loadOrMigrateUserMetadata returns early for it) — so
        // without this warning the "awaiting Client Portal account" message below
        // is misleading: it reads as "not yet granted" when it's really
        // "cannot be granted under this email at all".
        blockedProjectClientEmails() {
            const staffRoleByEmail = new Map(this.users
                .filter(user => user.role && user.role !== 'Client')
                .map(user => [String(user.email || '').trim().toLowerCase(), user.role]));
            return this.unlinkedProjectClientEmails
                .filter(email => staffRoleByEmail.has(email))
                .map(email => ({ email, role: staffRoleByEmail.get(email) }));
        },
        // The rest of unlinkedProjectClientEmails: saved on the client's Bill To
        // record, not colliding with any staff account, and genuinely doesn't
        // have a Client Portal login yet. Client access uses the email registered
        // by staff in Client Information, including an external domain.
        awaitingProjectClientEmails() {
            const blocked = new Set(this.blockedProjectClientEmails.map(b => b.email));
            return this.unlinkedProjectClientEmails.filter(email => !blocked.has(email));
        },
        projectStaffOptions() {
            // A Project PIC may schedule work for any provisioned colleague, but
            // Staff/IT users deliberately cannot read the full employees collection
            // (which contains payroll and identity data). Build the safe assignment
            // list from the already-authorized portal directory, then enrich it with
            // HR details only when those are available to the current role.
            const byEmail = new Map();
            this.users
                .filter(user => user.role !== 'Client' && String(user.email || '').trim())
                .forEach(user => {
                    const email = String(user.email || '').trim().toLowerCase();
                    byEmail.set(email, {
                        empNo: user.empNo || `PORTAL-${user.id}`,
                        name: user.name || email,
                        email,
                        position: user.position || user.role || 'STAFF'
                    });
                });
            this.employees
                .filter(employee => employee.email && employee.empNo)
                .forEach(employee => {
                    const email = String(employee.email || '').trim().toLowerCase();
                    byEmail.set(email, { ...byEmail.get(email), ...employee, email });
                });
            return [...byEmail.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        },
        myPendingProjectActivities() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.projectActivities.filter(activity => activity.status !== 'Done' && String(activity.assignedEmail || '').trim().toLowerCase() === email).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
        }
};