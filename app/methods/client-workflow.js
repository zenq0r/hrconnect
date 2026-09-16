// The client-facing workflow: project updates and replies, quotation accept /
// reject decisions, and payment-proof upload and review.
import {
    db,
    auth,
    storage,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    storageRef,
    uploadBytes,
    getDownloadURL
} from "../../firebase-config.js";
import { CLIENT_TIER_ORDER, canonicalClientTier, CLIENT_TIER_FEATURES } from "../constants/client-tiers.js";
export const clientWorkflowMethods = {
        clientUpdatesFor(projectId) {
            return this.projectClientUpdates.filter(update => update.projectId === projectId).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
        },
        canSendClientUpdate(project) {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return this.canManageProjects || (this.userProfile.role !== 'Client' && String(project?.ownerEmail || '').trim().toLowerCase() === email);
        },
        // The one gate every tier check goes through. An unknown key is treated
        // as ungated so adding a feature to the UI can never silently lock it.
        clientTierAllows(featureKey) {
            const feature = CLIENT_TIER_FEATURES.find(item => item.key === featureKey);
            if (!feature) return true;
            const index = CLIENT_TIER_ORDER.indexOf(canonicalClientTier(this.clientPortalIdentity?.clientTier));
            return index >= feature.minTier;
        },
        clientTierLockMessage(featureKey) {
            const feature = CLIENT_TIER_FEATURES.find(item => item.key === featureKey);
            if (!feature) return '';
            return `${feature.label} is available on the ${CLIENT_TIER_ORDER[feature.minTier]} tier and above.`;
        },
        // Priority-tier: reaches Director/Superadmin directly by email — real
        // and immediate, unlike an in-app notification the recipient might not
        // be looking at — rather than waiting on the normal PIC-first queue.
        // Reuses logAudit/notifyByEmail (already-deployed serverless routes) so
        // this needs no new /api function on a plan that is already near its
        // function-count ceiling.
        escalateClientIssue(message) {
            if (!this.clientTierAllows('issue-escalation')) { this.showNotify(this.clientTierLockMessage('issue-escalation'), 'error'); return false; }
            const trimmed = String(message || '').trim();
            if (!trimmed) { this.showNotify('Describe the issue before escalating it.', 'error'); return false; }
            const clientName = this.clientPortalIdentity?.clientName || this.userProfile.name || 'A Priority client';
            this.logAudit('CREATE', `Priority escalation from ${clientName}: ${trimmed.slice(0, 300)}`);
            this.notifyByEmail({
                to: [...this.emailsForRole('Director'), ...this.emailsForRole('Superadmin')],
                subject: `Priority Escalation — ${clientName}`,
                heading: 'A Priority client escalated an issue directly to you',
                message: `${clientName} (${this.userProfile.email}) raised the following issue for immediate attention:\n\n${trimmed}`
            });
            this.clientEscalationMessage = '';
            this.showNotify('Escalated to Director/Superadmin. You will be contacted directly.');
            return true;
        },
        canReplyAsClient(project) {
            // A secondary authorized contact's uid never matches the project's single
            // clientPortalUid (always the primary contact's), so authorize by the shared
            // clientDirectoryId claim instead of comparing uids directly.
            // Replying is a Premium feature. Gating it here rather than on the
            // button means every caller inherits the check; firestore.rules
            // enforces the same boundary server-side.
            if (!this.clientTierAllows('client-reply')) return false;
            return this.userProfile.role === 'Client' && Boolean(this.userProfile.clientDirectoryId) && String(project?.clientDirectoryId || '') === String(this.userProfile.clientDirectoryId || '');
        },
        clientProjectStatusBadgeClass(status) {
            const statusClasses = {
                'Project Planning': 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200',
                'Pending Documentation': 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
                'In Progress': 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
                'Pending By Government': 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
                'Completed & Done': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
            };
            return statusClasses[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
        },
        canEditClientUpdate(update) {
            return this.canManageProjects || String(update?.senderUid || '') === String(this.userProfile.uid || '');
        },
        canDeleteClientUpdate(update) {
            return this.canManageProjects || (this.userProfile.role === 'Client' && update?.senderRole === 'Client' && String(update?.senderUid || '') === String(this.userProfile.uid || ''));
        },
        openClientUpdateModal(project, update = null) {
            if (update ? !this.canEditClientUpdate(update) : !this.canSendClientUpdate(project)) { this.showNotify('Only the assigned PIC, original sender, Director or Superadmin may manage this Client update.'); return; }
            this.clientUpdateModal = {
                show: true,
                isEdit: Boolean(update),
                updateId: update?.id || '',
                original: update ? JSON.parse(JSON.stringify(update)) : null,
                project: JSON.parse(JSON.stringify(project)),
                form: { updateType: update?.updateType || 'Progress Update', updateDate: update?.updateDate || this.getLocalDateKey(), message: update?.message || '' }
            };
        },
        closeClientUpdateModal() {
            this.clientUpdateModal = { show: false, isEdit: false, updateId: '', original: null, project: null, form: { updateType: 'Progress Update', updateDate: '', message: '' } };
        },
        // Converts an internal project action into a deliberately minimal update for
        // the Client Portal. Never pass activity type, task summary, assignee or any
        // staff-only notes here: clients receive project progress only.
        async publishClientProjectEvent(project, message, updateType = 'Project Activity Update') {
            if (!project?.id || !project?.clientDirectoryId || !project?.clientPortalUid || !project?.clientEmail) return false;
            const updateId = `SYS-UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: project.clientPortalUid,
                clientEmail: String(project.clientEmail || '').trim().toLowerCase(),
                updateType,
                updateDate: this.getLocalDateKey(),
                message,
                senderUid: this.userProfile.uid,
                senderName: 'ZENQOR Project Team',
                senderEmail: this.userProfile.email,
                senderPosition: 'Project Team',
                senderRole: this.userProfile.role,
                systemGenerated: true,
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                return true;
            } catch (error) {
                // Do not roll back the completed internal action. The activity/project
                // remains correct; log the separate feed failure for follow-up.
                console.error('Client project event publish failed:', error);
                return false;
            }
        },
        async saveClientUpdate() {
            const project = this.clientUpdateModal.project;
            const form = this.clientUpdateModal.form;
            const isEdit = this.clientUpdateModal.isEdit;
            const original = this.clientUpdateModal.original;
            if (!project || (isEdit ? !this.canEditClientUpdate(original) : !this.canSendClientUpdate(project))) { this.showNotify('You do not have permission to save this Client update.'); return; }
            if (!form.updateType || !form.updateDate || !form.message?.trim()) { this.showNotify('Complete Update Type, Update Date and Client Message.'); return; }
            if (isEdit) {
                try {
                    await setDoc(doc(db, 'project_client_updates', this.clientUpdateModal.updateId), this.normalizeOfficialRecord({ updateType: form.updateType, updateDate: form.updateDate, message: form.message, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid }), { merge: true });
                    this.logAudit('UPDATE', `Updated Client activity history for ${project.projectRef}`);
                    this.closeClientUpdateModal();
                    this.showNotify('Client activity history updated.');
                } catch (error) {
                    console.error('Client project update edit failed:', error);
                    this.showNotify(this.getFirestoreWriteError(error, 'update the Client activity history'));
                }
                return;
            }
            const currentEmployee = this.employees.find(employee => String(employee.email || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase());
            const updateId = `UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: project.clientPortalUid,
                clientEmail: project.clientEmail,
                updateType: form.updateType,
                updateDate: form.updateDate,
                message: form.message,
                senderUid: this.userProfile.uid,
                senderName: this.userProfile.name,
                senderEmail: this.userProfile.email,
                senderPosition: currentEmployee?.position || this.getRoleDisplayName(this.userProfile.role),
                senderRole: this.userProfile.role,
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                this.logAudit('CREATE', `Client update sent for ${payload.projectRef}`);
                this.closeClientUpdateModal();
                this.showNotify('Client update sent and added to Client Activity History.');
                this.notifyByEmail({
                    to: payload.clientEmail,
                    subject: `New Update on Your Project — ${payload.projectRef}`,
                    heading: 'New Update From Your Project Team',
                    message: `${payload.senderName} posted a "${payload.updateType}" update on "${payload.projectTitle}" (${payload.projectRef}):\n\n"${payload.message}"`
                });
            } catch (error) {
                console.error('Client project update failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'send the Client project update'));
            }
        },
        // A client may answer their own quotation while it is still Open. The
        // Firestore rule enforces the same three conditions independently — this
        // only decides whether the buttons are worth showing.
        canDecideQuotation(d) {
            if (this.userProfile.role !== 'Client') return false;
            if (!d || d.type !== 'Quotation' || (d.status || 'Open') !== 'Open') return false;
            return this.clientPortalDocs.some(own => own.id === d.id);
        },
        async runBillingWorkflow(action, documentId, extra = {}) {
            if (!auth.currentUser?.uid) throw new Error('Your session has ended. Please sign in again.');
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch('/api/billing-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ action, documentId, ...extra })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'The billing workflow could not be updated.');
            return data;
        },
        async decideQuotation(d, decision) {
            if (!this.canDecideQuotation(d)) { this.showNotify('This quotation can no longer be answered.', 'error'); return; }
            const accepting = decision === 'Accepted';
            const { confirmed, note } = await this.askConfirmWithNote({
                title: accepting ? 'Accept this quotation?' : 'Decline this quotation?',
                message: accepting
                    ? `Accepting ${d.docNo} confirms the scope and pricing shown. Our team will be notified and will proceed to invoicing.`
                    : `Declining ${d.docNo} tells our team you do not wish to proceed. You can ask for a revised quotation at any time.`,
                confirmLabel: accepting ? 'Yes, Accept' : 'Yes, Decline',
                danger: !accepting,
                noteLabel: accepting ? 'Note for our team (optional)' : 'Reason for declining (optional)',
                notePlaceholder: accepting ? 'Anything we should know before invoicing' : 'What would need to change'
            });
            if (!confirmed) return;
            try {
                await updateDoc(doc(db, 'docs', d.id), {
                    status: decision,
                    clientDecisionAt: new Date().toISOString(),
                    clientDecisionByUid: this.userProfile.uid,
                    clientDecisionByName: this.userProfile.name || this.userProfile.email,
                    clientDecisionNote: note
                });
            } catch (error) {
                console.error('Quotation decision failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'record your decision'), 'error');
                return;
            }
            // From here the decision is recorded. Whatever happens to the
            // handover, the client is not told it failed.
            this.logAudit('UPDATE', `Client ${accepting ? 'accepted' : 'declined'} quotation ${d.docNo}`);
            const who = this.userProfile.name || this.userProfile.email;
            if (!accepting) {
                // A decline goes through the same server handler as an
                // acceptance, so both outcomes land in billing_timeline. It
                // used to be an e-mail and nothing else, which left no record
                // of why a quotation was never invoiced.
                try {
                    await this.runBillingWorkflow('quotation-declined', d.id);
                    this.showNotify('Quotation declined. Our team has been notified.');
                } catch (error) {
                    console.error('Quotation decline handover could not be started:', error);
                    this.showNotify('Quotation declined. Our team has been notified.');
                    this.notifyByEmail({
                        to: this.clientTeamRecipients(d),
                        subject: `Quotation Declined — ${d.docNo}`,
                        heading: 'Quotation Declined',
                        message: `${who} declined quotation ${d.docNo} (${this.formatCurrency(d.amount)}).${note ? `\n\nNote: "${note}"` : ''}`
                    });
                }
                return;
            }
            try {
                // The server derives the PIC, Finance and Director recipients
                // from protected records. Client-side code never chooses them.
                await this.runBillingWorkflow('quotation-accepted', d.id);
                this.showNotify('Quotation accepted. PIC, Finance and Director have been notified.');
            } catch (error) {
                console.error('Quotation handover could not be started:', error);
                this.showNotify('Quotation accepted. Our team has been told and will follow up with you.');
                this.notifyByEmail({
                    to: this.clientTeamRecipients(d),
                    subject: `Quotation Accepted — ${d.docNo} (follow up manually)`,
                    heading: 'Quotation Accepted',
                    message: `${who} accepted quotation ${d.docNo} (${this.formatCurrency(d.amount)}), but the automatic handover to Finance could not be created: ${error.message} Prepare the invoice from the Billing Workflow.${note ? `\n\nNote: "${note}"` : ''}`
                });
            }
        },
        // Who at the company hears about a client's decision when the server
        // workflow cannot route it: the project's PIC, and the company inbox.
        // /api/notify accepts only staff accounts as a client's recipients.
        clientTeamRecipients(d) {
            const project = this.projects.find(item => String(item.id) === String(d?.raw?.projectId || ''));
            return [project?.ownerEmail, this.company.email || this.supportEmail].filter(Boolean);
        },
        // Proof may be attached to an unpaid invoice of the client's own. It
        // records evidence; it never settles the invoice — staff mark Paid.
        canAttachPaymentProof(d) {
            if (this.userProfile.role !== 'Client') return false;
            if (!d || d.type !== 'Invoice' || ['Paid', 'Cancelled'].includes(d.status)) return false;
            return this.clientPortalDocs.some(own => own.id === d.id);
        },
        clientBillingStatus(d) {
            if (d?.type !== 'Invoice') return d?.status || 'Open';
            if (d.status === 'Cancelled') return 'Cancelled';
            if (d.paymentProofReviewStatus === 'Verified' || d.status === 'Paid') return 'Paid';
            if (d.paymentProofReviewStatus === 'Submitted') return 'Pending Verification';
            if (d.paymentProofReviewStatus === 'Rejected') return 'Proof Needs Attention';
            return d.status || 'Unpaid';
        },
        // Payment Reference No. and the receipt used to be collected separately —
        // the reference was typed by staff when the invoice was first created,
        // before the client had even paid, which nothing could actually verify.
        // The full proof — which bank, whose account, when, how much, the
        // reference and the receipt — now comes from the client themselves,
        // together, in one modal, at the moment they submit proof of a payment
        // they have already made. Amount defaults to the invoice's own total —
        // the common case is paying it in full — but stays editable for a
        // partial or already-adjusted payment.
        openPaymentProofModal(d) {
            if (!this.canAttachPaymentProof(d)) { this.showNotify('Proof cannot be attached to this invoice.', 'error'); return; }
            this.paymentProofModal = { show: true, doc: d, bankName: '', accountType: '', accountHolderName: '', paymentDate: this.getLocalDateKey(), amount: d?.amount != null ? String(d.amount) : '', refNo: '', file: null, fileName: '', uploading: false, error: '' };
        },
        closePaymentProofModal() {
            if (this.paymentProofModal.uploading) return;
            this.paymentProofModal = { show: false, doc: null, bankName: '', accountType: '', accountHolderName: '', paymentDate: '', amount: '', refNo: '', file: null, fileName: '', uploading: false, error: '' };
        },
        async selectPaymentProofFile(event) {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            try {
                await this.validateClientDocumentFile(file);
                this.paymentProofModal.file = file;
                this.paymentProofModal.fileName = file.name;
                this.paymentProofModal.error = '';
            } catch (error) {
                this.paymentProofModal.file = null;
                this.paymentProofModal.fileName = '';
                this.paymentProofModal.error = error.message || 'That file could not be used.';
            }
        },
        async submitPaymentProof() {
            const d = this.paymentProofModal.doc;
            const bankName = this.paymentProofModal.bankName;
            const accountType = this.paymentProofModal.accountType;
            const accountHolderName = this.paymentProofModal.accountHolderName.trim();
            const paymentDate = this.paymentProofModal.paymentDate;
            const amount = Number(this.paymentProofModal.amount);
            const refNo = this.paymentProofModal.refNo.trim();
            const file = this.paymentProofModal.file;
            if (!bankName) { this.paymentProofModal.error = 'Select the bank you paid from.'; return; }
            if (!accountType) { this.paymentProofModal.error = 'Select whether you paid from a Personal or a Business account.'; return; }
            if (!accountHolderName) { this.paymentProofModal.error = accountType === 'Business' ? 'Enter the company name on the paying account.' : 'Enter the name on the paying account.'; return; }
            if (!paymentDate) { this.paymentProofModal.error = 'Enter the date you made the payment.'; return; }
            if (!amount || amount <= 0) { this.paymentProofModal.error = 'Enter the amount you paid.'; return; }
            if (!refNo) { this.paymentProofModal.error = 'Enter the payment reference number from your bank transfer.'; return; }
            if (!file) { this.paymentProofModal.error = 'Attach your receipt or payment screenshot.'; return; }
            if (!d || !this.canAttachPaymentProof(d)) { this.paymentProofModal.error = 'Proof cannot be attached to this invoice.'; return; }
            const clientDirectoryId = this.userProfile.clientDirectoryId || d.raw?.customerId || '';
            if (!clientDirectoryId) { this.paymentProofModal.error = 'Your account is not linked to a client record yet.'; return; }
            this.paymentProofModal.uploading = true;
            this.paymentProofModal.error = '';
            try {
                const contentType = await this.validateClientDocumentFile(file);
                const safeName = String(file.name || 'payment-proof').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
                const storageFileName = `${Date.now()}_${safeName}`;
                const storagePath = `client_documents/${clientDirectoryId}/${storageFileName}`;
                const fileRef = storageRef(storage, storagePath);
                await uploadBytes(fileRef, file, { contentType });
                const downloadURL = await getDownloadURL(fileRef);
                // Also filed in the client's document repository, so the proof is
                // findable later on its own rather than only through the invoice.
                await setDoc(doc(db, 'client_documents', `${clientDirectoryId}_${Date.now()}`), {
                    clientDirectoryId,
                    clientName: this.clientPortalIdentity.clientName || '',
                    clientEmail: this.userProfile.email,
                    fileName: file.name,
                    fileType: contentType,
                    fileSize: file.size,
                    storagePath,
                    storageFileName,
                    downloadURL,
                    purpose: 'Payment Proof',
                    linkedDocId: d.id,
                    linkedDocNo: d.docNo || '',
                    clientPaymentBank: bankName,
                    clientPaymentAccountType: accountType,
                    clientPaymentAccountHolder: accountHolderName,
                    clientPaymentDate: paymentDate,
                    clientPaymentAmount: amount,
                    paymentRefNo: refNo,
                    uploadedByUid: this.userProfile.uid,
                    uploadedByName: this.userProfile.name,
                    uploadedByEmail: this.userProfile.email,
                    uploadedAt: new Date().toISOString()
                });
                await updateDoc(doc(db, 'docs', d.id), {
                    paymentProofUrl: downloadURL,
                    paymentProofName: file.name,
                    clientPaymentBank: bankName,
                    clientPaymentAccountType: accountType,
                    clientPaymentAccountHolder: accountHolderName,
                    clientPaymentDate: paymentDate,
                    clientPaymentAmount: amount,
                    paymentRefNo: refNo,
                    paymentProofAt: new Date().toISOString(),
                    paymentProofByUid: this.userProfile.uid,
                    paymentProofByName: this.userProfile.name || this.userProfile.email
                });
                this.logAudit('UPDATE', `Client attached payment proof to ${d.docNo} (${bankName}, ${accountType}, ref: ${refNo})`);
                this.closePaymentProofModal();
                // The proof is on the invoice now. If routing it for review fails,
                // the client is not told the upload failed; the team is emailed.
                try {
                    await this.runBillingWorkflow('payment-proof-submitted', d.id);
                    this.showNotify('Payment proof submitted. Finance, Director and your PIC will review it.');
                } catch (workflowError) {
                    console.error('Payment proof review could not be started:', workflowError);
                    this.showNotify('Payment proof submitted. Our team has been told and will review it.');
                    this.notifyByEmail({
                        to: this.clientTeamRecipients(d),
                        subject: `Payment Proof Submitted — ${d.docNo} (review manually)`,
                        heading: 'Payment Proof Submitted',
                        message: `${this.userProfile.name || this.userProfile.email} attached payment proof to ${d.docNo}, but it could not be routed for review automatically: ${workflowError.message} Review it from the Billing Workflow.`
                    });
                }
            } catch (error) {
                console.error('Payment proof upload failed:', error);
                this.paymentProofModal.error = this.getFirestoreWriteError(error, 'submit your payment proof');
            } finally {
                this.paymentProofModal.uploading = false;
            }
        },
        async sendClientReply() {
            const project = this.projectPreview.project;
            if (!this.clientTierAllows('client-reply')) { this.showNotify(this.clientTierLockMessage('client-reply'), 'error'); return; }
            if (!project || !this.canReplyAsClient(project)) { this.showNotify('You do not have permission to reply on this project.'); return; }
            const message = this.clientReplyMessage.trim();
            if (!message) { this.showNotify('Write a message before sending.'); return; }
            const updateId = `UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const payload = this.normalizeOfficialRecord({
                projectId: project.id,
                projectRef: project.projectRef,
                projectTitle: project.title,
                clientDirectoryId: project.clientDirectoryId,
                clientPortalUid: this.userProfile.uid,
                clientEmail: project.clientEmail,
                updateType: 'Client Reply',
                updateDate: this.getLocalDateKey(),
                message,
                senderUid: this.userProfile.uid,
                senderName: this.userProfile.name,
                senderEmail: this.userProfile.email,
                senderPosition: 'Client',
                senderRole: 'Client',
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'project_client_updates', updateId), payload);
                this.logAudit('CREATE', `Client reply sent for ${payload.projectRef}`);
                this.clientReplyMessage = '';
                this.showNotify('Your reply has been sent.');
                this.notifyByEmail({
                    to: project.ownerEmail,
                    subject: `New Client Reply — ${payload.projectRef}`,
                    heading: 'New Reply From Your Client',
                    message: `${payload.senderName} replied on "${payload.projectTitle}" (${payload.projectRef}):\n\n"${message}"`
                });
            } catch (error) {
                console.error('Client reply failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'send your reply'));
            }
        },
        startEditReply(update) {
            this.editingReplyId = update.id;
            this.editingReplyMessage = update.message;
        },
        cancelEditReply() {
            this.editingReplyId = '';
            this.editingReplyMessage = '';
        },
        async saveReplyEdit(update) {
            const message = this.editingReplyMessage.trim();
            if (!message) { this.showNotify('Message cannot be empty.'); return; }
            try {
                await setDoc(doc(db, 'project_client_updates', update.id), this.normalizeOfficialRecord({ message, updatedAt: new Date().toISOString(), updatedByUid: this.userProfile.uid }), { merge: true });
                this.logAudit('UPDATE', `Edited client reply for ${update.projectRef}`);
                this.cancelEditReply();
                this.showNotify('Reply updated.');
            } catch (error) {
                console.error('Reply edit failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update your reply'));
            }
        },
        async deleteClientUpdate(update) {
            if (!this.canDeleteClientUpdate(update)) { this.showNotify('Only Director, Superadmin, or the original sender may delete this Client activity history entry.'); return; }
            if (!await this.askConfirm({
                title: 'Delete client update?',
                message: `Client update dated ${update.updateDate || '-'} will be removed. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Update',
                danger: true
            })) return;
            try {
                await deleteDoc(doc(db, 'project_client_updates', update.id));
                this.logAudit('DELETE', `Deleted Client activity history ${update.id}`);
                this.showNotify('Client activity history deleted.');
            } catch (error) {
                console.error('Client activity history deletion failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete the Client activity history'));
            }
        }
};