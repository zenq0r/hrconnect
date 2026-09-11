// Project board: stages, drag and drop, project records, and the activity
// (task) list inside each project.
import {
    db,
    auth,
    collection,
    doc,
    setDoc,
    updateDoc,
    getDocs,
    writeBatch,
    query,
    where
} from "../../firebase-config.js";
export const projectMethods = {
        // This needs to be a method (rather than a computed value) because each
        // project is checked individually. The registered task IDs themselves
        // remain computed above, so the result still refreshes live with Client
        // Task changes without causing a Vue render error.
        isProjectLinkedToRegisteredClientTask(project) {
            const clientDirectoryId = String(project?.clientDirectoryId || '').trim();
            if (!clientDirectoryId) return false;
            // Staff and IT cannot read the Client Directory (see the customers rule),
            // so this.customers is empty for them and the parent-task check below
            // would hide every project — including the ones where they are the PIC.
            // Their project list is already scoped by Firestore to exactly what they
            // may see, so the client-side integrity gate only applies to the roles
            // that can actually evaluate it.
            if (!this.canReadClientDirectory) return true;
            return this.registeredClientTaskIds.has(clientDirectoryId);
        },
        projectWithLiveClientData(project) {
            const customer = this.customers.find(item => item.id === project.clientDirectoryId);
            if (!customer) return project;
            return {
                ...project,
                clientName: customer.clientName || project.clientName || '',
                clientEmail: String(customer.clientEmail || project.clientEmail || '').trim().toLowerCase(),
                clientSSM: customer.clientSSM || project.clientSSM || '',
                clientTier: customer.clientTier || project.clientTier || 'Standard'
            };
        },
        getProjectsByStage(stage) {
            return this.filteredProjects.filter(project => project.status === stage);
        },
        getClientGroupsByStage(stage) {
            const groups = [];
            const indexByKey = new Map();
            this.getProjectsByStage(stage).forEach(project => {
                // filteredProjects already rejects unlinked projects. Keeping the
                // explicit guard here protects this grouping if it is reused.
                if (!this.isProjectLinkedToRegisteredClientTask(project)) return;
                const key = project.clientDirectoryId;
                if (!indexByKey.has(key)) {
                    indexByKey.set(key, groups.length);
                    groups.push({ key, clientDirectoryId: project.clientDirectoryId, clientName: project.clientName || 'Unknown Client', projects: [] });
                }
                groups[indexByKey.get(key)].projects.push(project);
            });
            return groups;
        },
        toggleClientGroup(groupKey) {
            if (this.expandedClientGroups.has(groupKey)) this.expandedClientGroups.delete(groupKey);
            else this.expandedClientGroups.add(groupKey);
        },
        isClientGroupExpanded(groupKey) {
            return this.expandedClientGroups.has(groupKey);
        },
        openProjectDetails(project) {
            const projectSnapshot = JSON.parse(JSON.stringify(project));
            // Open the essential project summary first so the click can paint promptly.
            // The document/activity timelines can be expensive on large client accounts,
            // therefore they mount on the following frame without changing their data.
            this.projectPreview = { show: true, project: projectSnapshot, detailsReady: false };
            const defer = typeof window.requestAnimationFrame === 'function'
                ? window.requestAnimationFrame.bind(window)
                : (callback) => window.setTimeout(callback, 0);
            defer(() => defer(() => {
                if (!this.projectPreview.show || this.projectPreview.project?.id !== projectSnapshot.id) return;
                this.projectPreview.detailsReady = true;
                if (this.canViewClientDocuments) this.loadClientDocuments(projectSnapshot.clientDirectoryId, projectSnapshot.clientName, projectSnapshot.clientEmail);
            }));
        },
        closeProjectDetails() {
            this.projectPreview = { show: false, project: null, detailsReady: false };
            this.clientReplyMessage = '';
            this.editingReplyId = '';
            this.editingReplyMessage = '';
            this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
        },
        editProjectFromPreview() {
            const project = this.projectPreview.project ? JSON.parse(JSON.stringify(this.projectPreview.project)) : null;
            this.closeProjectDetails();
            if (project) this.openProjectModal(project);
        },
        projectActivitiesFor(projectId) {
            return this.projectActivities.filter(activity => activity.projectId === projectId).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
        },
        // What the CURRENT viewer may see in the Activity Issues list. A PIC or
        // Project Manager sees the whole schedule; anyone else sees only the
        // activities assigned to them, matching the project_activities read rule
        // (their listener never receives the rest in the first place).
        visibleProjectActivitiesFor(projectId) {
            const project = this.projects.find(item => item.id === projectId);
            if (this.canManageProjectActivities(project)) return this.projectActivitiesFor(projectId);
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.projectActivitiesFor(projectId)
                .filter(activity => String(activity.assignedEmail || '').trim().toLowerCase() === email);
        },
        // Recomputes the project's activityAssigneeEmails access index from the
        // activity list the caller is about to end up with. Only a PIC or Project
        // Manager ever calls this, and both read every activity of that project, so
        // the list is complete. Returns null when the stored index is already
        // correct, so no redundant project write is queued.
        nextActivityAssigneeIndex(projectId, activities) {
            const project = this.projects.find(item => item.id === projectId);
            // Only a PIC or Project Manager receives EVERY activity of a project.
            // Anyone else holds just their own rows, so recomputing from their view
            // would silently drop the other assignees out of the index — refuse
            // rather than write a truncated one.
            if (!project || !this.canManageProjectActivities(project)) return null;
            const normalize = list => [...new Set(list
                .map(value => String(value || '').trim().toLowerCase())
                .filter(Boolean))].sort();
            const next = normalize(activities.map(activity => activity?.assignedEmail));
            const current = normalize(Array.isArray(project.activityAssigneeEmails) ? project.activityAssigneeEmails : []);
            const unchanged = next.length === current.length && next.every((email, index) => email === current[index]);
            return unchanged ? null : next;
        },
        async syncProjectActivityOwners() {
            // Existing activities predate projectOwnerEmail. A Director or
            // Superadmin repairs only that safe access index after deployment;
            // no activity content, status, assignee, or audit fields are changed.
            if (!this.canManageProjects || this.activityOwnerSyncRunning || !this.projects.length || !this.projectActivities.length) return;
            const projectOwnerById = new Map(this.projects.map(project => [project.id, String(project.ownerEmail || '').trim().toLowerCase()]));
            const pending = this.projectActivities.filter(activity => {
                const ownerEmail = projectOwnerById.get(activity.projectId);
                return ownerEmail && String(activity.projectOwnerEmail || '').trim().toLowerCase() !== ownerEmail;
            });
            if (!pending.length) return;
            this.activityOwnerSyncRunning = true;
            try {
                for (let start = 0; start < pending.length; start += 450) {
                    const batch = writeBatch(db);
                    pending.slice(start, start + 450).forEach(activity => {
                        batch.update(doc(db, 'project_activities', activity.id), {
                            projectOwnerEmail: projectOwnerById.get(activity.projectId)
                        });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error('Unable to synchronize project activity access:', error);
            } finally {
                this.activityOwnerSyncRunning = false;
            }
        },
        async syncProjectActivityAssignees() {
            // Projects created before activityAssigneeEmails existed carry no index,
            // so their activity assignees would still be locked out. Every PIC repairs
            // their OWN projects (and a Project Manager repairs all of them), so the
            // backfill does not sit waiting for a Director to sign in. Only that one
            // access field is touched — no project stage, client, owner or audit
            // field. It converges after one pass because nextActivityAssigneeIndex
            // returns null once the stored index already matches, and returns null
            // outright for projects this user does not manage.
            if (this.userProfile.role === 'Client' || this.activityAssigneeSyncRunning || !this.projects.length || !this.projectActivitiesLoaded) return;
            const pending = this.projects
                .map(project => ({ project, index: this.nextActivityAssigneeIndex(project.id, this.projectActivitiesFor(project.id)) }))
                .filter(entry => entry.index);
            if (!pending.length) return;
            this.activityAssigneeSyncRunning = true;
            try {
                const now = new Date().toISOString();
                for (let start = 0; start < pending.length; start += 450) {
                    const batch = writeBatch(db);
                    pending.slice(start, start + 450).forEach(entry => {
                        batch.update(doc(db, 'projects', entry.project.id), {
                            activityAssigneeEmails: entry.index,
                            updatedAt: now
                        });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error('Unable to synchronize project activity assignee access:', error);
            } finally {
                this.activityAssigneeSyncRunning = false;
            }
        },
        projectActivityDueState(activity) {
            if (activity.status === 'Done') return { label: 'Done', className: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200', borderClass: 'border-l-slate-400 dark:border-l-slate-600', dotClass: 'bg-slate-400', daysRemaining: null };
            const today = this.getLocalDateKey();
            const dueDate = String(activity.dueDate || '');
            const daysRemaining = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
            if (!Number.isFinite(daysRemaining)) return { label: 'No Due Date', className: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200', borderClass: 'border-l-slate-400 dark:border-l-slate-600', dotClass: 'bg-slate-400', daysRemaining: null };
            if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)} Day${Math.abs(daysRemaining) === 1 ? '' : 's'} Overdue`, className: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300', borderClass: 'border-l-red-500', dotClass: 'bg-red-500', daysRemaining };
            if (daysRemaining === 0) return { label: 'Due Today', className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', dotClass: 'bg-amber-400', daysRemaining };
            if (daysRemaining <= 3) return { label: `Due In ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}`, className: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', dotClass: 'bg-emerald-500', daysRemaining };
            return { label: `Scheduled · ${daysRemaining} Days`, className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borderClass: 'border-l-blue-500', dotClass: 'bg-blue-500', daysRemaining };
        },
        projectTargetDateState(project) {
            if (project.status === 'Completed & Done') return { label: 'Completed', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', daysRemaining: null };
            const today = this.getLocalDateKey();
            const targetDate = String(project.targetDate || '');
            const daysRemaining = Math.round((Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
            if (!Number.isFinite(daysRemaining)) return { label: 'No Target', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300', borderClass: 'border-l-slate-300 dark:border-l-slate-600', daysRemaining: null };
            if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)}d Overdue`, className: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300', borderClass: 'border-l-red-500', daysRemaining };
            if (daysRemaining === 0) return { label: 'Due Today', className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', daysRemaining };
            if (daysRemaining <= 3) return { label: `Due In ${daysRemaining}d`, className: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300', borderClass: 'border-l-amber-400', daysRemaining };
            if (daysRemaining <= 7) return { label: `Due In ${daysRemaining}d`, className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300', borderClass: 'border-l-blue-500', daysRemaining };
            return { label: `On Track · ${daysRemaining}d`, className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300', borderClass: 'border-l-emerald-500', daysRemaining };
        },
        isProjectOwner(project) {
            if (!project) return false;
            return this.userProfile.role !== 'Client' && String(project.ownerEmail || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase();
        },
        canEditProject(project) {
            return this.canManageProjects || this.isProjectOwner(project);
        },
        canManageProjectActivities(project) {
            return this.canManageProjects || this.isProjectOwner(project);
        },
        // Assignment is what grants sight of the Activity Issues panel: the PIC and
        // Project Managers see the whole schedule, and a staff member with at least
        // one activity assigned to them in this project sees their own rows (see
        // visibleProjectActivitiesFor). Scheduling, editing and completing remain
        // with the PIC — this is a read grant only, exactly as the rules allow.
        isAssignedToProjectActivity(project) {
            return Boolean(project?.id) && this.assignedActivityProjectIds.has(project.id);
        },
        canViewProjectActivityDetails(project) {
            return this.canManageProjectActivities(project) || this.isAssignedToProjectActivity(project);
        },
        // Editing an activity (retargeting it, changing its type) stays with the
        // PIC, but COMPLETING one belongs to whoever the work was scheduled for —
        // which is what the dashboard's "My Assigned Project Activities" card has
        // always offered. Mirrors the assignee branch of the update rule.
        canCompleteProjectActivity(activity) {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.canEditProjectActivity(activity) || (
                this.userProfile.role !== 'Client' &&
                Boolean(email) &&
                String(activity?.assignedEmail || '').trim().toLowerCase() === email
            );
        },
        canEditProjectActivity(activity) {
            const project = this.projects.find(p => p.id === activity?.projectId);
            return this.canManageProjectActivities(project);
        },
        canDeleteProjectActivity() { return this.canManageProjects; },
        openActivityModal(project, activity = null) {
            if (!this.canManageProjectActivities(project)) { this.showNotify('Only Director, Superadmin, or this project\'s Person In Charge may schedule activities.'); return; }
            this.activityModal = { show: true, isEdit: Boolean(activity), activityId: activity?.id || '', project: JSON.parse(JSON.stringify(project)), form: { activityType: activity?.activityType || 'To-Do', summary: activity?.summary || '', dueDate: activity?.dueDate || this.getLocalDateKey(), assignedEmpNo: activity?.assignedEmpNo || '', assignedName: activity?.assignedName || '', assignedEmail: activity?.assignedEmail || '', assignedPosition: activity?.assignedPosition || '', details: activity?.details || '' } };
        },
        closeActivityModal() {
            this.activityModal = { show: false, isEdit: false, activityId: '', project: null, form: { activityType: 'To-Do', summary: '', dueDate: '', assignedEmpNo: '', assignedName: '', assignedEmail: '', assignedPosition: '', details: '' } };
        },
        selectActivityAssignee(event) {
            const employee = this.projectStaffOptions.find(item => item.empNo === event.target.value);
            this.activityModal.form.assignedEmpNo = employee?.empNo || '';
            this.activityModal.form.assignedName = employee?.name || '';
            this.activityModal.form.assignedEmail = String(employee?.email || '').trim().toLowerCase();
            this.activityModal.form.assignedPosition = employee?.position || '';
        },
        async saveProjectActivity() {
            if (!this.activityModal.project || !this.canManageProjectActivities(this.activityModal.project)) { this.showNotify('You do not have permission to schedule this activity.'); return; }
            const form = this.activityModal.form;
            if (!form.activityType || !form.summary?.trim() || !form.dueDate || !form.assignedEmpNo || !form.assignedEmail) { this.showNotify('Complete Activity Type, Summary, Due Date and Assigned To.'); return; }
            const project = this.activityModal.project;
            if (this.activityModal.isEdit) {
                try {
                    const editedAt = new Date().toISOString();
                    const editedAssignee = String(form.assignedEmail || '').trim().toLowerCase();
                    // Reassigning an activity moves project access with it: the new
                    // assignee is added to the index and the previous one drops out
                    // of it in the same atomic write as the activity itself.
                    const nextIndex = this.nextActivityAssigneeIndex(project.id, this.projectActivitiesFor(project.id)
                        .map(activity => activity.id === this.activityModal.activityId
                            ? { ...activity, assignedEmail: editedAssignee }
                            : activity));
                    const editBatch = writeBatch(db);
                    editBatch.set(doc(db, 'project_activities', this.activityModal.activityId), this.normalizeOfficialRecord({ activityType: form.activityType, summary: form.summary, dueDate: form.dueDate, assignedEmpNo: form.assignedEmpNo, assignedName: form.assignedName, assignedEmail: form.assignedEmail, assignedPosition: form.assignedPosition, details: form.details, updatedAt: editedAt, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email }), { merge: true });
                    if (nextIndex) editBatch.update(doc(db, 'projects', project.id), { activityAssigneeEmails: nextIndex, updatedAt: editedAt });
                    await editBatch.commit();
                    await this.publishClientProjectEvent(project, 'A scheduled project activity has been updated. Our project team will continue the required work.');
                    this.logAudit('UPDATE', `Updated project activity for ${project.projectRef}`);
                    this.closeActivityModal();
                    this.showNotify('Project activity updated.');
                } catch (error) {
                    console.error('Project activity update failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the project activity'));
                }
                return;
            }
            const activityId = `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                // This is a non-sensitive access index. It lets Firestore return
                // activity details only to the current project PIC without giving
                // every staff account a readable copy of every activity.
                projectOwnerEmail: String(project.ownerEmail || '').trim().toLowerCase(),
                clientPortalUid: project.clientPortalUid,
                clientEmail: project.clientEmail,
                activityType: form.activityType,
                summary: form.summary,
                dueDate: form.dueDate,
                assignedEmpNo: form.assignedEmpNo,
                assignedName: form.assignedName,
                assignedEmail: form.assignedEmail,
                assignedPosition: form.assignedPosition,
                details: form.details,
                status: 'Scheduled',
                createdAt: new Date().toISOString(),
                createdByUid: this.userProfile.uid,
                createdByEmail: this.userProfile.email
            });
            try {
                // The assignee needs the project card too, or the activity has
                // nowhere to open from — index and activity are written together.
                const nextIndex = this.nextActivityAssigneeIndex(project.id, [...this.projectActivitiesFor(project.id), payload]);
                const createBatch = writeBatch(db);
                createBatch.set(doc(db, 'project_activities', activityId), payload);
                if (nextIndex) createBatch.update(doc(db, 'projects', project.id), { activityAssigneeEmails: nextIndex, updatedAt: payload.createdAt });
                await createBatch.commit();
                await this.publishClientProjectEvent(project, 'A new project activity has been scheduled. Our project team will continue the required work.');
                this.logAudit('CREATE', `Scheduled ${payload.activityType} for ${payload.projectRef} and assigned to ${payload.assignedName}`);
                this.closeActivityModal();
                this.showNotify('Project activity scheduled. The assigned employee will receive an in-portal alert.');
            } catch (error) {
                console.error('Project activity scheduling failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'schedule the project activity'));
            }
        },
        async markProjectActivityDone(activity) {
            if (!this.canCompleteProjectActivity(activity)) { this.showNotify('Only the assigned employee, this project\'s Person In Charge, Director or Superadmin may complete this activity.'); return; }
            try {
                await updateDoc(doc(db, 'project_activities', activity.id), { status: 'Done', completedAt: new Date().toISOString(), completedByUid: this.userProfile.uid, completedByEmail: this.userProfile.email });
                const project = this.projects.find(item => item.id === activity.projectId);
                // The client-facing conversation feed stays the PIC's voice: an
                // assignee completing their own row is an internal event, and
                // attempting the write here would only be denied by the rules.
                if (project && this.canSendClientUpdate(project)) await this.publishClientProjectEvent(project, 'A scheduled project activity has been completed. Our project team will continue with the next step.');
                this.logAudit('UPDATE', `Completed project activity ${activity.summary}`);
                this.showNotify('Project activity marked as done.');
            } catch (error) {
                console.error('Project activity completion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'complete the project activity'));
            }
        },
        async deleteProjectActivity(activity) {
            if (!this.canDeleteProjectActivity(activity)) { this.showNotify('Only Director and Superadmin may delete project activities.'); return; }
            if (!await this.askConfirm({
                title: 'Delete activity?',
                message: `"${activity.summary || activity.id}" will be removed. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Activity',
                danger: true
            })) return;
            try {
                // Deleting someone's last activity in a project also withdraws their
                // read access to it, in the same atomic write.
                const deletedAt = new Date().toISOString();
                const nextIndex = this.nextActivityAssigneeIndex(activity.projectId, this.projectActivitiesFor(activity.projectId)
                    .filter(item => item.id !== activity.id));
                const deleteBatch = writeBatch(db);
                deleteBatch.delete(doc(db, 'project_activities', activity.id));
                if (nextIndex) deleteBatch.update(doc(db, 'projects', activity.projectId), { activityAssigneeEmails: nextIndex, updatedAt: deletedAt });
                await deleteBatch.commit();
                this.logAudit('DELETE', `Deleted project activity ${activity.id}`);
                this.showNotify('Project activity deleted.');
            } catch (error) {
                console.error('Project activity deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the project activity'));
            }
        },
        selectProjectClientDirectory(event) {
            const customer = this.customers.find(item => item.id === event.target.value);
            if (!customer) {
                this.projectModal.form.clientDirectoryId = '';
                this.projectModal.form.clientPortalUid = '';
                this.projectModal.form.clientName = '';
                this.projectModal.form.clientEmail = '';
                this.projectModal.form.clientSSM = '';
                this.projectModal.form.clientTier = 'Standard';
                return;
            }
            this.projectModal.form.clientDirectoryId = customer.id;
            this.projectModal.form.clientName = customer.clientName || '';
            this.projectModal.form.clientSSM = customer.clientSSM || '';
            this.projectModal.form.clientTier = customer.clientTier || 'Standard';
            // projectClientAccessUsers is already filtered down to exactly this
            // customer's authorized emails (it re-derives the same authorizedEmails
            // set from projectModal.form.clientDirectoryId, which was just set
            // above), so this find() only ever searches an already-authorized pool
            // by email — there is deliberately no name-based fallback here. A
            // company name is not unique or stable enough to safely stand in for a
            // real portal-account match (see the docs/customerId fix).
            const matchingAccess = this.projectClientAccessUsers.find(user => String(user.email || '').trim());
            this.projectModal.form.clientPortalUid = matchingAccess?.id || '';
            this.projectModal.form.clientEmail = matchingAccess?.email || '';
        },
        selectProjectClientAccess(event) {
            const user = this.projectClientAccessUsers.find(item => item.id === event.target.value);
            this.projectModal.form.clientPortalUid = user?.id || '';
            this.projectModal.form.clientEmail = user?.email || '';
        },
        selectProjectOwner(event) {
            const employee = this.projectStaffOptions.find(item => item.empNo === event.target.value);
            if (!employee) return;
            const previousOwner = this.projectModal.form.ownerEmpNo;
            this.projectModal.form.ownerEmpNo = employee.empNo;
            this.projectModal.form.ownerName = employee.name || '';
            this.projectModal.form.ownerEmail = String(employee.email || '').trim().toLowerCase();
            this.projectModal.form.ownerPhoto = this.employeePhotoByEmail(employee.email);
            this.projectModal.form.ownerPosition = employee.position || '';
            this.projectModal.form.ownerDepartment = employee.dept || '';
            this.projectModal.form.ownerPresenceStatus = this.employeePresenceLabel(employee);
            this.projectModal.form.ownerPresenceUpdatedAt = employee.presenceUpdatedAt || '';
            this.projectModal.form.ownerLastSeen = employee.lastSeen || '';
            if (previousOwner !== employee.empNo || !this.projectModal.form.ownerAssignedAt) this.projectModal.form.ownerAssignedAt = new Date().toISOString();
        },
        isProjectPicOnline(project) {
            const lastUpdate = this.getPresenceTime(project.ownerPresenceUpdatedAt || project.ownerLastSeen);
            return project.ownerPresenceStatus === 'Online' && lastUpdate > 0 && (this.presenceNow - lastUpdate) < 90000;
        },
        projectPicPresenceDetail(project) {
            if (this.isProjectPicOnline(project)) return 'Online now';
            return project.ownerLastSeen ? `Last seen ${this.formatDateTime(project.ownerLastSeen)}` : 'Offline — no recent activity';
        },
        openProjectModal(project = null) {
            if (project ? !this.canEditProject(project) : !this.canManageProjects) { this.showNotify(project ? 'Only Director, Superadmin, or this project\'s Person In Charge may edit this project.' : 'Only Director and Superadmin may create new projects.'); return; }
            const emptyForm = { id: '', projectRef: `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, title: '', clientDirectoryId: '', clientPortalUid: '', clientName: '', clientEmail: '', clientSSM: '', clientTier: 'Standard', ownerEmpNo: '', ownerName: '', ownerEmail: '', ownerPhoto: '', ownerPosition: '', ownerDepartment: '', ownerAssignedAt: '', ownerPresenceStatus: 'Offline', ownerPresenceUpdatedAt: '', ownerLastSeen: '', status: 'Project Planning', startDate: '', targetDate: '', description: '' };
            this.projectModal = { show: true, isEdit: Boolean(project), form: project ? JSON.parse(JSON.stringify(project)) : emptyForm };
        },
        closeProjectModal() {
            this.projectModal.show = false;
        },
        async saveProject() {
            const source = this.projectModal.form;
            const isEdit = this.projectModal.isEdit;
            const original = isEdit ? this.projects.find(p => p.id === source.id) : null;
            if (isEdit && !original) { this.showNotify('This project no longer exists. It may have been deleted.'); this.closeProjectModal(); return; }
            const isAdminEditor = this.canManageProjects;
            const authorized = isEdit ? (isAdminEditor || this.isProjectOwner(original)) : isAdminEditor;
            if (!authorized) { this.showNotify('You do not have permission to save this project.'); return; }
            if (!source.status || !this.projectStages.includes(source.status)) { this.showNotify('Invalid project stage.'); return; }
            const now = new Date().toISOString();

            if (isEdit && !isAdminEditor) {
                const payload = this.normalizeOfficialRecord({
                    status: source.status,
                    startDate: source.startDate,
                    targetDate: source.targetDate,
                    description: source.description,
                    updatedAt: now,
                    updatedByUid: this.userProfile.uid,
                    updatedByEmail: this.userProfile.email
                });
                try {
                    await setDoc(doc(db, 'projects', source.id), payload, { merge: true });
                    if (source.status !== original.status) await this.publishClientProjectEvent(original, `Project status changed to ${source.status}.`, 'Project Status');
                    this.logAudit('UPDATE', `Project progress updated for ${original.projectRef}`);
                    this.closeProjectModal();
                    this.showNotify('Project progress updated successfully.');
                    if (source.status !== original.status) this.notifyByEmail({
                        to: original.clientEmail,
                        subject: `Project Update — ${original.projectRef}: ${source.status}`,
                        heading: 'Your Project Has Been Updated',
                        message: `Your project "${original.title}" (${original.projectRef}) has moved to the "${source.status}" stage.`
                    });
                } catch (error) {
                    console.error('Project save failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the project'));
                }
                return;
            }

            if (!source.projectRef?.trim() || !source.title?.trim()) { this.showNotify('Project reference and title are required.'); return; }
            if (!source.clientDirectoryId || !source.clientPortalUid || !source.clientEmail) { this.showNotify('Select a Client Directory record and its matching Client Portal Access account.'); return; }
            const authorizedClientAccount = this.projectClientAccessUsers.find(user => user.id === source.clientPortalUid && String(user.email || '').trim().toLowerCase() === String(source.clientEmail || '').trim().toLowerCase());
            if (!authorizedClientAccount) { this.showNotify('The selected Client Portal account is not authorized in this Client Directory. Save its email under Client Portal Access first.'); return; }
            if (!source.ownerEmpNo || !source.ownerEmail) { this.showNotify('Select a Person In Charge from HR Employee Management.'); return; }
            const projectId = source.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const payload = this.normalizeOfficialRecord({
                projectRef: isEdit ? original.projectRef : source.projectRef,
                title: source.title,
                clientDirectoryId: source.clientDirectoryId,
                clientPortalUid: source.clientPortalUid,
                clientName: source.clientName,
                clientEmail: String(source.clientEmail || '').trim().toLowerCase(),
                // Keep a tier snapshot on the project. Client accounts cannot read
                // the full customer directory, so this remains a safe fallback if
                // their individual customer record has not loaded yet.
                clientTier: this.clientTierForId(source.clientDirectoryId, source.clientTier),
                ownerEmpNo: source.ownerEmpNo,
                ownerName: source.ownerName,
                ownerEmail: String(source.ownerEmail || '').trim().toLowerCase(),
                // This is the PIC's public project avatar only. It lets a client
                // see their assigned PIC without read access to every staff profile.
                ownerPhoto: source.ownerPhoto || this.employeePhotoByEmail(source.ownerEmail),
                ownerPosition: source.ownerPosition,
                ownerDepartment: source.ownerDepartment,
                ownerAssignedAt: source.ownerAssignedAt || now,
                ownerPresenceStatus: source.ownerPresenceStatus || 'Offline',
                ownerPresenceUpdatedAt: source.ownerPresenceUpdatedAt || '',
                ownerLastSeen: source.ownerLastSeen || '',
                status: source.status,
                startDate: source.startDate,
                targetDate: source.targetDate,
                description: source.description,
                updatedAt: now,
                updatedByUid: this.userProfile.uid,
                updatedByEmail: this.userProfile.email,
                ...(isEdit ? {} : { createdAt: now, createdByUid: this.userProfile.uid, createdByEmail: this.userProfile.email })
            });
            try {
                const ownerChanged = isEdit && String(original?.ownerEmail || '').trim().toLowerCase() !== payload.ownerEmail;
                if (!isEdit && !this.customers.find(customer => customer.id === payload.clientDirectoryId)?.clientTaskCreatedAt) {
                    // A Client Task is the mandatory parent of every Project
                    // Activity. Create the missing parent in the same batch as
                    // the project: a project can never be committed by this UI
                    // without its Client Task.
                    const creationBatch = writeBatch(db);
                    creationBatch.set(doc(db, 'customers', payload.clientDirectoryId), {
                        clientTaskCreatedAt: now,
                        updatedAt: now,
                        updatedByUid: this.userProfile.uid
                    }, { merge: true });
                    creationBatch.set(doc(db, 'projects', projectId), payload);
                    await creationBatch.commit();
                } else if (ownerChanged) {
                    // Director/Superadmin may change the PIC from the project form.
                    // Update all linked access indexes atomically so the old PIC
                    // cannot retain activity access after the transfer.
                    const ownerChangeBatch = writeBatch(db);
                    ownerChangeBatch.set(doc(db, 'projects', projectId), payload, { merge: true });
                    this.projectActivitiesFor(projectId).forEach(activity => {
                        ownerChangeBatch.update(doc(db, 'project_activities', activity.id), { projectOwnerEmail: payload.ownerEmail });
                    });
                    await ownerChangeBatch.commit();
                } else {
                    await setDoc(doc(db, 'projects', projectId), payload, { merge: isEdit });
                }
                this.logAudit(isEdit ? 'UPDATE' : 'CREATE', `Project activity ${payload.projectRef}`);
                if (isEdit && original && source.status !== original.status) await this.publishClientProjectEvent(payload, `Project status changed to ${source.status}.`, 'Project Status');
                this.closeProjectModal();
                this.showNotify('Project activity saved successfully.');
                if (isEdit && original && source.status !== original.status) this.notifyByEmail({
                    to: payload.clientEmail,
                    subject: `Project Update — ${payload.projectRef}: ${source.status}`,
                    heading: 'Your Project Has Been Updated',
                    message: `Your project "${payload.title}" (${payload.projectRef}) has moved to the "${source.status}" stage.`
                });
            } catch (error) {
                console.error('Project save failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'save the project activity'));
            }
        },
        async moveProject(project, direction) {
            const currentIndex = this.projectStages.indexOf(project.status);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.projectStages.length) return;
            const moved = await this.moveProjectToStage(project, this.projectStages[nextIndex]);
            if (moved) this.showNotify(`Project moved to ${this.projectStages[nextIndex]}.`);
        },
        // Shared by the arrow buttons (moveProject, always ±1 stage) and the
        // board's drag-and-drop (any stage, dropped directly). Returns whether
        // the write actually happened.
        async moveProjectToStage(project, targetStage) {
            if (!this.canEditProject(project)) { this.showNotify('You do not have permission to update this project stage.'); return false; }
            if (project.status === targetStage) return false;
            try {
                await updateDoc(doc(db, 'projects', project.id), { status: targetStage, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email });
                await this.publishClientProjectEvent(project, `Project status changed to ${targetStage}.`, 'Project Status');
                this.logAudit('UPDATE', `Project ${project.projectRef} moved to ${targetStage}`);
                this.notifyByEmail({
                    to: project.clientEmail,
                    subject: `Project Update — ${project.projectRef}: ${targetStage}`,
                    heading: 'Your Project Has Been Updated',
                    message: `Your project "${project.title}" (${project.projectRef}) has moved to the "${targetStage}" stage.`
                });
                return true;
            } catch (error) {
                console.error('Project stage update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the project stage'));
                return false;
            }
        },
        // Board drag-and-drop — always drags exactly ONE project, never a whole
        // client group, so a company with several projects in the same stage
        // can never be bulk-moved by accident. The collapsed client-group card
        // is only draggable when that group has exactly one project (dragging
        // it is then unambiguous); a group with more than one project must be
        // expanded first and dragged via its individual project row instead.
        canDragClientGroup(group) {
            return group.projects.length === 1 && this.canEditProject(group.projects[0]);
        },
        startGroupDrag(event, group, stage) {
            if (!this.canDragClientGroup(group)) { event.preventDefault(); return; }
            this.startProjectDrag(event, group.projects[0], stage);
        },
        startProjectDrag(event, project, stage) {
            if (!this.canEditProject(project)) { event.preventDefault(); return; }
            this.draggingProject = { project, sourceStage: stage };
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', project.id);
            }
        },
        endDrag() {
            this.draggingProject = null;
            this.dragOverStage = '';
        },
        onStageDragOver(stage) {
            if (!this.draggingProject || this.draggingProject.sourceStage === stage) return;
            this.dragOverStage = stage;
        },
        onStageDragLeave(stage) {
            if (this.dragOverStage === stage) this.dragOverStage = '';
        },
        async onStageDrop(targetStage) {
            const drag = this.draggingProject;
            this.draggingProject = null;
            this.dragOverStage = '';
            if (!drag || drag.sourceStage === targetStage) return;
            const moved = await this.moveProjectToStage(drag.project, targetStage);
            if (moved) this.showNotify(`Project moved to ${targetStage}.`);
        },
        openMarkProjectDoneModal(project) {
            if (!this.canEditProject(project)) { this.showNotify('You do not have permission to update this project.'); return; }
            this.markProjectDoneModal = { show: true, project, newOwnerEmpNo: '', confirmStep: null, saving: false };
        },
        closeMarkProjectDoneModal() {
            this.markProjectDoneModal = { show: false, project: null, newOwnerEmpNo: '', confirmStep: null, saving: false };
        },
        requestMarkProjectDone() {
            this.markProjectDoneModal.confirmStep = this.markProjectDoneModal.newOwnerEmpNo ? 'handover' : 'complete';
        },
        async confirmMarkProjectDone() {
            const modal = this.markProjectDoneModal;
            const project = modal.project;
            if (!project || !this.canEditProject(project)) { this.showNotify('You do not have permission to update this project.'); return; }
            modal.saving = true;
            const nowIso = new Date().toISOString();
            try {
                if (modal.newOwnerEmpNo) {
                    const newOwner = this.projectStaffOptions.find(emp => emp.empNo === modal.newOwnerEmpNo);
                    if (!newOwner) { this.showNotify('Selected staff member could not be found.'); modal.saving = false; return; }
                    const newOwnerEmail = String(newOwner.email || '').trim().toLowerCase();
                    const existingHistory = Array.isArray(project.handoverHistory) ? project.handoverHistory : [];
                    const handoverHistory = [
                        ...existingHistory,
                        {
                            fromEmpNo: project.ownerEmpNo || '', fromName: project.ownerName || '', fromEmail: project.ownerEmail || '',
                            toEmpNo: newOwner.empNo, toName: newOwner.name || '', toEmail: newOwnerEmail,
                            handedOverByUid: this.userProfile.uid, handedOverByEmail: this.userProfile.email, handedOverAt: nowIso
                        }
                    ];
                    // Keep the activity access index in the same atomic write as
                    // the handover. The incoming PIC can therefore open Activity
                    // Type and Assigned To immediately; the outgoing PIC loses
                    // access at the same time.
                    const handoverBatch = writeBatch(db);
                    handoverBatch.update(doc(db, 'projects', project.id), {
                        ownerEmpNo: newOwner.empNo,
                        ownerName: newOwner.name || '',
                        ownerEmail: newOwnerEmail,
                        ownerPhoto: this.employeePhotoByEmail(newOwner.email) || '',
                        ownerPosition: newOwner.position || '',
                        ownerDepartment: newOwner.dept || '',
                        ownerAssignedAt: nowIso,
                        ownerPresenceStatus: newOwner.presenceStatus || 'Offline',
                        ownerPresenceUpdatedAt: newOwner.presenceUpdatedAt || '',
                        ownerLastSeen: newOwner.lastSeen || '',
                        handoverHistory,
                        updatedAt: nowIso, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email
                    });
                    this.projectActivitiesFor(project.id).forEach(activity => {
                        handoverBatch.update(doc(db, 'project_activities', activity.id), { projectOwnerEmail: newOwnerEmail });
                    });
                    await handoverBatch.commit();
                    this.logAudit('UPDATE', `Handed over project ${project.projectRef} from ${project.ownerName || 'Unassigned'} to ${newOwner.name}`);
                    this.showNotify(`Project handed over to ${newOwner.name}.`);
                    if (newOwnerEmail) this.notifyByEmail({
                        to: newOwnerEmail,
                        subject: `Project Handed Over To You — ${project.projectRef}`,
                        heading: 'A Project Has Been Assigned To You',
                        message: `${this.userProfile.name} has handed over "${project.title}" (${project.projectRef}) to you. Sign in to the portal to continue this project.`
                    });
                } else {
                    await updateDoc(doc(db, 'projects', project.id), {
                        status: 'Completed & Done',
                        completedAt: nowIso, completedByUid: this.userProfile.uid, completedByEmail: this.userProfile.email,
                        updatedAt: nowIso, updatedByUid: this.userProfile.uid, updatedByEmail: this.userProfile.email
                    });
                    await this.publishClientProjectEvent(project, 'Project status changed to Completed & Done.', 'Project Status');
                    this.logAudit('UPDATE', `Marked project ${project.projectRef} as Completed & Done`);
                    this.showNotify('Project marked as Done.');
                    if (project.clientEmail) this.notifyByEmail({
                        to: project.clientEmail,
                        subject: `Project Update — ${project.projectRef}: Completed & Done`,
                        heading: 'Your Project Has Been Updated',
                        message: `Your project "${project.title}" (${project.projectRef}) has moved to the "Completed & Done" stage.`
                    });
                }
                this.closeMarkProjectDoneModal();
            } catch (error) {
                console.error('Mark project done failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the project'));
                modal.saving = false;
            }
        },
        async deleteProject(project) {
            if (!this.canManageProjects) { this.showNotify('You do not have permission to delete project activities.'); return false; }
            const linkedActivities = this.projectActivitiesFor(project.id);
            const linkedUpdates = this.clientUpdatesFor(project.id);
            const cascadeWarning = (linkedActivities.length || linkedUpdates.length)
                ? ` This will also permanently delete ${linkedActivities.length} activity issue(s) and ${linkedUpdates.length} client update(s) linked to this project.`
                : '';
            if (!await this.askConfirm({
                title: `Delete project ${project.projectRef}?`,
                message: `${cascadeWarning.trim() || 'This project will be permanently removed.'} This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Project',
                danger: true
            })) return false;
            try {
                const batch = writeBatch(db);
                linkedActivities.forEach(activity => batch.delete(doc(db, 'project_activities', activity.id)));
                linkedUpdates.forEach(update => batch.delete(doc(db, 'project_client_updates', update.id)));
                batch.delete(doc(db, 'projects', project.id));
                await batch.commit();
                this.logAudit('DELETE', `Project activity ${project.projectRef} (with ${linkedActivities.length} activity issue(s) and ${linkedUpdates.length} client update(s))`);
                this.showNotify('Project and all linked records deleted.');
                return true;
            } catch (error) {
                console.error('Project deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the project activity'));
                return false;
            }
        },
        async deleteProjectFromPreview() {
            const project = this.projectPreview.project;
            if (!project) return;
            if (await this.deleteProject(project)) this.closeProjectDetails();
        },
        async deleteProjectFromModal() {
            const project = this.projectModal.form;
            if (!project?.id) return;
            if (await this.deleteProject(project)) this.closeProjectModal();
        },
        async syncAssignedProjectPresence(employee, isOnline, timestamp) {
            if (!auth.currentUser || !employee?.empNo || !employee?.email) return;
            try {
                const snapshot = await getDocs(query(collection(db, 'projects'), where('ownerEmpNo', '==', employee.empNo), where('ownerEmail', '==', String(employee.email).trim().toLowerCase())));
                if (snapshot.empty) return;
                const batch = writeBatch(db);
                snapshot.docs.forEach(projectDoc => batch.update(projectDoc.ref, {
                    ownerPresenceStatus: isOnline ? 'Online' : 'Offline',
                    ownerPresenceUpdatedAt: timestamp,
                    ownerLastSeen: timestamp
                }));
                await batch.commit();
            } catch (error) {
                console.error('Unable to synchronize assigned project presence:', error);
            }
        },
        getActivityStatus(item) {
            if (item.type === 'Invoice') {
                return item.status === 'Paid'
                    ? { label: 'PAID', detail: 'Payment received', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' }
                    : { label: 'UNPAID', detail: 'Payment not received', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
            }
            if (item.isClaim || ['Claim', 'Payment Voucher'].includes(item.documentType || item.type)) {
                const isPaymentVoucher = (item.documentType || item.type) === 'Payment Voucher';
                const statuses = {
                    'Pending HR': { label: 'PENDING HR', detail: 'Awaiting HR approval', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
                    'Pending Account': { label: 'PENDING FINANCE', detail: 'HR approved — Finance action required', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
                    'Pending Director': { label: 'PENDING DIRECTOR', detail: 'Finance approved — Director action required', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
                    'Approved': { label: 'APPROVED', detail: isPaymentVoucher ? 'Payment fully paid' : 'Claim fully approved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
                    'Rejected': { label: 'REJECTED', detail: isPaymentVoucher ? 'Payment voucher rejected' : 'Claim rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' }
                };
                return statuses[item.status] || { label: 'PENDING', detail: 'Awaiting action', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' };
            }
            return { label: 'RECORDED', detail: 'Record created', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' };
        }
};