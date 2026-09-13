// Everything a signed-in person sees about themselves: their own payslips,
// claims and documents, and the client account's tier, timeline and totals.
import { CLIENT_TIER_ORDER, canonicalClientTier, CLIENT_TIER_FEATURES, CLIENT_SUPPORT_CHANNELS, CLIENT_TIMELINE_PREVIEW_COUNT } from "../constants/client-tiers.js";
export const clientPortalComputed = {
        currentYear() { return new Date().getFullYear(); },
        payslipYtdMultiplier() {
            const month = Number(String(this.payForm.month || '').split('-')[1]);
            return month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
        },
        employeeViewLiveRecord() {
            return this.employees.find(emp => emp.empNo === this.employeeView.employee.empNo) || this.employeeView.employee;
        },

        myPayslips() { return this.payslipHistory.filter(p => p.raw && (p.raw.empEmail === this.userProfile.email || p.name === this.userProfile.name)); },
        myLatestNetSalary() {
            if (this.myPayslips.length === 0) return 0;
            const sorted = [...this.myPayslips].sort((a, b) => new Date(b.date) - new Date(a.date));
            return Number(sorted[0].amount) || 0;
        },
        myClaims() { return this.claimsHistory.filter(c => c.empEmail === this.userProfile.email || c.name === this.userProfile.name); },
        myPaymentVouchers() { return this.paymentVouchers.filter(v => v.empEmail === this.userProfile.email || v.name === this.userProfile.name); },
        myPendingClaimsCount() { return [...this.myClaims, ...this.myPaymentVouchers].filter(c => c.status && c.status.includes('Pending')).length; },
        myApprovedClaimsAmount() { return [...this.myClaims, ...this.myPaymentVouchers].filter(c => c.status === 'Approved').reduce((sum, c) => sum + (Number(c.amount) || 0), 0); },

        // A secondary authorized contact's own email never matches raw.clientEmail
        // (always the primary contact's), so prefer matching by the shared
        // clientDirectoryId claim — same linkage the docs query itself now uses.
        myClientDocs() {
            const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
            const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
            // Keep the original email path as a narrow compatibility path for
            // billing records created before Client ID linking was mandatory.
            // It is an OR, rather than a fallback: a linked client can therefore
            // still retrieve its own historic records while all new records are
            // isolated by the immutable Client Directory ID.
            const owned = this.docHistory.filter(d => d.raw && (
                (clientDirectoryId && String(d.raw.customerId || '').trim() === clientDirectoryId) ||
                (clientEmail && String(d.raw.clientEmail || '').trim().toLowerCase() === clientEmail)
            ));
            // A registered client sees their complete history -- every record ever
            // filed against their Client ID, with no retention window on any tier.
            return owned;
        },
        myClientRecord() {
            if (this.userProfile.clientDirectoryId) {
                return this.customers.find(c => c.id === this.userProfile.clientDirectoryId) || null;
            }
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            if (!email) return null;
            return this.customers.find(c => String(c.clientEmail || '').trim().toLowerCase() === email) || null;
        },
        clientPortalIdentity() {
            if (this.myClientRecord) return this.myClientRecord;
            const linkedProject = this.projects.find(project => project.clientDirectoryId || project.clientName) || null;
            return {
                clientName: linkedProject?.clientName || this.userProfile.name || 'Client Account',
                // Projects carry no clientId snapshot, so this stays empty until the
                // directory record loads. The portal prints a placeholder, never the
                // clientDirectoryId document key, which is internal plumbing.
                clientId: '',
                clientSSM: linkedProject?.clientSSM || '',
                // Projects retain a tier snapshot for the portal fallback. The
                // authoritative value still comes from customers/{id} when it is
                // available (for example, after staff retag a client).
                clientTier: linkedProject?.clientTier || 'Standard',
                clientEmail: linkedProject?.clientEmail || this.userProfile.email || ''
            };
        },
        myClientPaidCount() { return this.clientPortalDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').length; },
        myClientUnpaidCount() { return this.clientPortalDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },
        clientActiveProjectsCount() { return this.projects.filter(project => project.status !== 'Completed & Done').length; },
        clientUpdatesTimeline() {
            // This is the Client Portal conversation feed, not a general activity log.
            // A client sees only safe project-status events and conversation messages
            // belonging to their own current projects. Internal Activity Type, PIC and
            // work notes are intentionally never copied to this collection.
            const visibleProjectIds = new Set(this.projects.map(project => String(project.id || '')).filter(Boolean));
            const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
            const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
            const allowedTypes = new Set([...this.clientUpdateTypes, 'Client Reply', 'Project Activity Update', 'Project Status']);
            const persistedUpdates = this.projectClientUpdates
                .filter(update => visibleProjectIds.has(String(update?.projectId || '')) ||
                    (clientDirectoryId && String(update?.clientDirectoryId || '') === clientDirectoryId) ||
                    (clientEmail && String(update?.clientEmail || '').trim().toLowerCase() === clientEmail))
                .filter(update => allowedTypes.has(String(update?.updateType || '')))
                .map(update => ({ ...update, isStatusSnapshot: false }));

            // Existing projects may predate the Client Portal update feed. Until an
            // activity/status event is recorded, show one live, safe status snapshot so
            // the client never receives an empty feed despite having an active project.
            const projectsWithPersistedUpdate = new Set(persistedUpdates.map(update => String(update.projectId || '')));
            const statusSnapshots = this.projects
                .filter(project => project?.id && !projectsWithPersistedUpdate.has(String(project.id)))
                .map(project => ({
                    id: `STATUS-SNAPSHOT-${project.id}-${project.updatedAt || project.createdAt || 'CURRENT'}`,
                    projectId: project.id,
                    projectRef: project.projectRef,
                    projectTitle: project.title,
                    updateType: 'Project Status',
                    updateDate: String(project.updatedAt || project.createdAt || this.getLocalDateKey()).slice(0, 10),
                    message: `Current project status: ${project.status || 'Project Planning'}.`,
                    senderRole: 'System',
                    senderName: 'ZENQOR Project Team',
                    createdAt: project.updatedAt || project.createdAt || '',
                    isStatusSnapshot: true
                }));

            return [...persistedUpdates, ...statusSnapshots]
                .sort((a, b) => String(b.createdAt || b.updateDate || '').localeCompare(String(a.createdAt || a.updateDate || '')));
        },
        clientProjectStatusCards() {
            return this.projects
                .filter(project => project?.id)
                .map(project => {
                    const latestProjectEvent = this.clientUpdatesTimeline
                        .filter(update => String(update.projectId || '') === String(project.id) &&
                            (update.isStatusSnapshot || update.systemGenerated || update.updateType === 'Project Status'))
                        .sort((a, b) => String(b.createdAt || b.updateDate || '').localeCompare(String(a.createdAt || a.updateDate || '')))[0] || null;
                    return { ...project, latestProjectEvent };
                })
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        },
        clientConversationHistory() {
            // Human-written messages only. System activity/status events live in
            // Current Project Status above, keeping the conversation easy to scan.
            return this.clientUpdatesTimeline.filter(update => !update.isStatusSnapshot && !update.systemGenerated && update.updateType !== 'Project Status');
        },
        clientRecentUpdates() {
            return this.clientConversationHistory.slice(0, 4);
        },
        clientRecentDocuments() {
            return [...this.myClientDocs].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5);
        },
        clientProfileCompletion() {
            const values = [this.userProfile.name, this.userProfile.email, this.userProfile.photo];
            return Math.round((values.filter(Boolean).length / values.length) * 100);
        },
        // ---- Client tier ----------------------------------------------------
        // The authoritative tier is customers/{id}.clientTier. clientPortalIdentity
        // already falls back to the project snapshot when the client record is not
        // loaded yet, so read through it rather than reaching for customers twice.
        // The Client ID printed in Staff Workspace > Client Registration >
        // Registered Client Directory. Empty until the directory record loads,
        // or on a record registered before Client IDs were issued -- staff
        // saving that record once mints one (see saveClientInformation).
        myClientId() { return String(this.clientPortalIdentity?.clientId || '').trim(); },
        myClientTier() { return canonicalClientTier(this.clientPortalIdentity?.clientTier); },
        myClientTierIndex() { return CLIENT_TIER_ORDER.indexOf(this.myClientTier); },
        clientTierFeatureList() {
            return CLIENT_TIER_FEATURES.map(feature => ({
                ...feature,
                tierLabel: CLIENT_TIER_ORDER[feature.minTier],
                unlocked: this.myClientTierIndex >= feature.minTier
            }));
        },
        clientSupportChannel() {
            return CLIENT_SUPPORT_CHANNELS[this.myClientTierIndex] || CLIENT_SUPPORT_CHANNELS[0];
        },
        clientNextTier() {
            return CLIENT_TIER_ORDER[this.myClientTierIndex + 1] || null;
        },
        clientUnlockedFeatureCount() {
            return this.clientTierFeatureList.filter(feature => feature.unlocked).length;
        },
        // Without full-timeline the conversation is capped at the most recent
        // entries. Both halves are derived from one constant so the visible list
        // and the 'N earlier entries' line can never disagree.
        clientVisibleConversation() {
            const history = this.clientConversationHistory;
            return this.clientTierAllows('full-timeline') ? history : history.slice(0, CLIENT_TIMELINE_PREVIEW_COUNT);
        },
        clientHiddenConversationCount() {
            return this.clientConversationHistory.length - this.clientVisibleConversation.length;
        },
        myUnpaidInvoicesCount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },
        myUnpaidInvoicesAmount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status !== 'Paid').reduce((sum, d) => sum + (Number(d.amount) || 0), 0); },
        myPaidInvoicesAmount() { return this.myClientDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').reduce((sum, d) => sum + (Number(d.amount) || 0), 0); }
};