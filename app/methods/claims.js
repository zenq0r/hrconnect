// Expense claims and payment vouchers: the Staff -> HR -> Account -> Director
// approval pipeline, bulk approval, editing and printing.
import {
    db,
    auth,
    doc,
    setDoc,
    updateDoc,
    writeBatch
} from "../../firebase-config.js";
export const claimMethods = {
        normalizeClaimRecord(record) {
            const documentType = record.documentType || (record.type === 'Payment Voucher' || /^PV-/i.test(record.receiptNo || '') ? 'Payment Voucher' : 'Claim');
            if (record.status !== 'Approved') return { ...record, documentType, type: documentType };
            const isPaymentVoucher = documentType === 'Payment Voucher';
            return {
                ...record,
                documentType,
                type: documentType,
                finalDecision: true,
                settlementStatus: isPaymentVoucher ? 'Paid' : 'Approved',
                statusDetail: isPaymentVoucher ? 'Payment fully paid' : 'Claim fully approved',
                assignedToUid: record.approvedByUid || record.assignedToUid || '',
                assignedToName: record.approvedByName || record.assignedToName || 'Director',
                assignedToEmail: record.approvedByEmail || '',
                assignedToRole: 'Director',
                approvalPath: record.approvalPath || (record.approvedByRole === 'Director' ? 'Director Direct Approval' : 'Director Final Approval')
            };
        },
        async synchronizeLegacyApprovedClaims(snapshotDocs) {
            if (this.legacyClaimMigrationRunning || !['Director', 'Superadmin'].includes(this.userProfile.role)) return;
            const migrations = [];
            snapshotDocs.forEach(snapshotDoc => {
                const existing = snapshotDoc.data();
                if (existing.status !== 'Approved') return;
                const normalized = this.normalizeClaimRecord(existing);
                const patch = {};
                ['documentType', 'type', 'finalDecision', 'settlementStatus', 'statusDetail', 'assignedToUid', 'assignedToName', 'assignedToEmail', 'assignedToRole', 'approvalPath'].forEach(field => {
                    if (existing[field] !== normalized[field]) patch[field] = normalized[field];
                });
                if (Object.keys(patch).length) migrations.push({ ref: snapshotDoc.ref, patch });
            });
            if (!migrations.length) return;
            this.legacyClaimMigrationRunning = true;
            try {
                for (let start = 0; start < migrations.length; start += 450) {
                    const batch = writeBatch(db);
                    migrations.slice(start, start + 450).forEach(item => batch.update(item.ref, item.patch));
                    await batch.commit();
                }
                this.showNotify(`${migrations.length} approved legacy record(s) synchronized.`);
            } catch (error) {
                console.error('Legacy approved record synchronization failed:', error);
            } finally {
                this.legacyClaimMigrationRunning = false;
            }
        },

        // ================================================================
        // EXPENSE CLAIM FLOW — dedicated end-to-end pipeline for 'claims' collection
        // WORKFLOW: Staff/Client -> HR -> Account -> Director (final approval)
        // ================================================================
        canApproveClaim(clm) {
            const role = this.userProfile.role;
            if (this.isFullAccessRole) return typeof clm.status === 'string' && clm.status.startsWith('Pending');
            const expectedStatus = { HR: 'Pending HR', Account: 'Pending Account', Director: 'Pending Director' }[role];
            return !!expectedStatus && clm.status === expectedStatus && (!clm.assignedToEmail || clm.assignedToEmail === this.userProfile.email);
        },
        // The submitter corrects their own claim until HR has looked at it.
        // Superadmin and Director may correct any claim at any stage — as an
        // explicit, stamped edit that firestore.rules keeps apart from approval
        // (see isAdminClaimCorrection), so a figure can never change inside the
        // same write that approves it.
        canEditClaim(clm) {
            return this.isFullAccessRole || this.isOwnPendingRecord(clm);
        },
        // A claim or voucher the signed-in person submitted that HR has not yet
        // looked at — the only kind a submitter may still change.
        isOwnPendingRecord(record) {
            return (record.createdByUid === this.userProfile.uid || record.empEmail === this.userProfile.email) && record.status === 'Pending HR';
        },
        // True when this save is an administrator correcting a record rather
        // than its submitter editing their own pending one — the two are
        // different permissions in firestore.rules, and only the correction
        // carries an edit stamp.
        isAdminCorrection(record) {
            if (!this.isFullAccessRole || !record) return false;
            return !this.isOwnPendingRecord(record);
        },
        // The stamp firestore.rules requires on that correction.
        adminCorrectionStamp() {
            return { lastEditedByUid: auth.currentUser.uid, lastEditedByName: this.userProfile.name || '', lastEditedAt: new Date().toISOString() };
        },
        // Appended to a correction's audit entry when the amount moved.
        amountChangeNote(previous, amount) {
            const was = Number(previous?.amount);
            return Number.isFinite(was) && was !== amount ? ` Amount ${this.formatCurrency(was)} → ${this.formatCurrency(amount)}.` : '';
        },
        // Who a claim or voucher is waiting on. An edit keeps the record wherever
        // it is in the approval chain — it used to hand every edited record back
        // to HR's queue. Only a new record starts with the first assignee.
        recordAssignment(form, isEdit, assignee) {
            const kept = (field, fallback) => isEdit ? (form[field] ?? fallback) : fallback;
            return {
                assignedToUid: kept('assignedToUid', assignee.id),
                assignedToName: kept('assignedToName', assignee.name),
                assignedToEmail: kept('assignedToEmail', assignee.email),
                assignedToRole: kept('assignedToRole', assignee.role)
            };
        },
        claimStageStamp(record, role) {
            if (!Array.isArray(record?.approvalHistory)) return null;
            return [...record.approvalHistory].reverse().find(entry => entry.role === role) || null;
        },
        // approvedByName/rejectedByName (top-level and inside approvalHistory entries) are
        // a name snapshot taken at the moment of that decision — unlike a payslip's
        // frozen payroll figures, "who approved this" is just an identity reference, so
        // if that person's name is later corrected in HR Employees (a typo fix, a legal
        // name change), the approval trail should show their current name rather than
        // whatever was on file that day. Falls back to the snapshot if the approver's
        // account can't be found live (e.g. the account was later deleted).
        approverNameLive(uid, fallbackName) {
            if (!uid) return fallbackName || '';
            const user = this.users.find(u => u.id === uid);
            return user?.name || fallbackName || '';
        },
        // Same idea as approverNameLive, but for "who requested/submitted this claim or
        // voucher" — matched by empNo against the live employees directory (not `users`,
        // since empNo/dept are HR-managed attributes) rather than a name snapshot frozen
        // at submission time. Applies regardless of approval status: unlike the amount,
        // category or dates on a claim (which must stay exactly as approved — a real
        // financial record), the requester's own name is just an identity reference, same
        // reasoning as the approver's name.
        requesterNameLive(empNo, fallbackName) {
            if (!empNo) return fallbackName || '';
            const employee = this.employees.find(e => e.id === empNo || e.empNo === empNo);
            return employee?.name || fallbackName || '';
        },
        requesterDeptLive(empNo, fallbackDept) {
            if (!empNo) return fallbackDept || '';
            const employee = this.employees.find(e => e.id === empNo || e.empNo === empNo);
            return employee?.dept || fallbackDept || '';
        },
        // Bulk approval — HR/Account only. Director decisions always require a
        // per-record supporting document attachment (see approveClaim/
        // approvePaymentVoucher), so bulk-approving isn't offered for Director;
        // each Director decision stays a deliberate, individual action.
        toggleClaimSelection(id) {
            const idx = this.selectedClaimIds.indexOf(id);
            if (idx === -1) this.selectedClaimIds.push(id); else this.selectedClaimIds.splice(idx, 1);
        },
        toggleVoucherSelection(id) {
            const idx = this.selectedVoucherIds.indexOf(id);
            if (idx === -1) this.selectedVoucherIds.push(id); else this.selectedVoucherIds.splice(idx, 1);
        },
        async bulkApproveSelectedClaims() {
            if (this.isFullAccessRole) { this.showNotify('Final approvals require an individual supporting document per claim — please approve one at a time.'); return; }
            const targets = this.claimsHistory.filter(c => this.selectedClaimIds.includes(c.id) && this.canApproveClaim(c));
            if (!targets.length) { this.showNotify('No eligible claims selected.'); return; }
            if (!await this.askConfirm({
                title: 'Approve selected claims?',
                message: `${targets.length} selected claim(s) will be approved and forwarded to the next reviewer.`,
                confirmLabel: 'Yes, Approve'
            })) return;
            let succeeded = 0;
            for (const clm of targets) { if (await this.approveClaim(clm)) succeeded++; }
            this.selectedClaimIds = [];
            this.showNotify(`${succeeded} of ${targets.length} claim(s) approved and forwarded.`);
        },
        async bulkApproveSelectedVouchers() {
            if (this.isFullAccessRole) { this.showNotify('Final approvals require an individual supporting document per voucher — please approve one at a time.'); return; }
            const targets = this.paymentVouchers.filter(v => this.selectedVoucherIds.includes(v.id) && this.canApprovePaymentVoucher(v));
            if (!targets.length) { this.showNotify('No eligible vouchers selected.'); return; }
            if (!await this.askConfirm({
                title: 'Approve selected vouchers?',
                message: `${targets.length} selected voucher(s) will be approved and forwarded to the next reviewer.`,
                confirmLabel: 'Yes, Approve'
            })) return;
            let succeeded = 0;
            for (const pv of targets) { if (await this.approvePaymentVoucher(pv)) succeeded++; }
            this.selectedVoucherIds = [];
            this.showNotify(`${succeeded} of ${targets.length} voucher(s) approved and forwarded.`);
        },
        async approveClaim(clm) {
            if (!this.canApproveClaim(clm)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.isFullAccessRole;
            const nextRole = isDirectorDecision ? null : { 'Pending HR': 'Account', 'Pending Account': 'Director' }[clm.status];
            const roleNames = { HR: 'Human Resource Management', Account: 'Finance Account Management', Director: 'Director' };
            if (isDirectorDecision && !this.claimPreview.directorApprovalAttachment) { this.showNotify('Director approval requires a supporting document attachment.'); return; }
            const bypassedReviews = clm.status === 'Pending HR' ? ['HR', 'Account'] : clm.status === 'Pending Account' ? ['Account'] : [];
            const nowIso = new Date().toISOString();
            const existingHistory = Array.isArray(clm.approvalHistory) ? clm.approvalHistory : [];
            const bypassEntries = bypassedReviews.map(role => ({ role, roleName: roleNames[role] || role, bypassed: true, note: 'Bypassed by Director direct approval', recordedAt: nowIso }));
            const approvalHistory = [
                ...existingHistory,
                ...bypassEntries,
                { role: this.userProfile.role, roleName: roleNames[this.userProfile.role] || this.userProfile.role, approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedAt: nowIso }
            ];
            const update = nextRole
                ? { status: `Pending ${nextRole}`, assignedToUid: '', assignedToName: roleNames[nextRole], assignedToEmail: '', assignedToRole: nextRole, approvalHistory }
                : { status: 'Approved', finalDecision: true, settlementStatus: 'Approved', statusDetail: 'Claim fully approved', approvalPath: 'Director Direct Approval', approvalPreviousStatus: clm.status, bypassedReviews, assignedToUid: this.userProfile.uid, assignedToName: this.userProfile.name, assignedToEmail: this.userProfile.email, assignedToRole: 'Director', approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedByRole: 'Director', approvedAt: nowIso, directorApprovalAttachment: this.claimPreview.directorApprovalAttachment, directorApprovalAttachmentName: this.claimPreview.directorApprovalAttachmentName, directorApprovalOriginalBytes: Number(this.claimPreview.directorApprovalOriginalBytes || 0), approvalHistory };
            try {
                if (!nextRole && this.getSerializedSize({ ...clm, ...update }) > 800 * 1024) throw Object.assign(new Error('This claim is too large to save with its attachments. Use fewer or smaller files.'), { code: 'resource-exhausted' });
                await updateDoc(doc(db, "claims", clm.id), update);
                this.logAudit('UPDATE', `Claim ${clm.receiptNo} ${nextRole ? `forwarded to ${roleNames[nextRole]}` : `directly and finally approved by Director${bypassedReviews.length ? ` (bypassed ${bypassedReviews.join(' and ')})` : ''}`}`);
                this.showNotify(nextRole ? `Claim assigned to ${roleNames[nextRole]}.` : 'Director approval completed immediately. No further HR or Finance review is required.');
                if (nextRole) this.notifyByEmail({
                    to: this.emailsForRole(nextRole),
                    subject: `Expense Claim Pending Your Review — ${clm.receiptNo}`,
                    heading: 'Expense Claim Forwarded To You',
                    message: `${clm.name}'s expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) was approved by ${roleNames[this.userProfile.role]} and is now pending your review.`
                }); else this.notifyByEmail({
                    to: clm.empEmail,
                    subject: `Your Expense Claim Was Approved — ${clm.receiptNo}`,
                    heading: 'Expense Claim Approved',
                    message: `Your expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) has been fully approved by the Director. No further action is needed on your part.`
                });
                return true;
            } catch (error) {
                console.error('Claim approval failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the claim status'));
                return false;
            }
        },
        async approveClaimFromPreview() {
            const approved = await this.approveClaim(this.claimPreview.claim);
            if (approved) this.claimPreview.show = false;
        },
        async rejectClaim(clm) {
            if (!this.canApproveClaim(clm)) { this.showNotify('You do not have permission to reject this record at its current workflow stage.'); return; }
            if (!await this.askConfirm({
                title: 'Reject this claim?',
                message: `Claim ${clm.receiptNo} for ${this.formatCurrency(clm.amount)} will be rejected and the claimant notified by email.`,
                confirmLabel: 'Yes, Reject Claim',
                danger: true
            })) return;
            try { await updateDoc(doc(db, "claims", clm.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Claim rejected."); this.notifyByEmail({ to: clm.empEmail, subject: `Your Expense Claim Was Rejected — ${clm.receiptNo}`, heading: 'Expense Claim Rejected', message: `Your expense claim of ${this.formatCurrency(clm.amount)} (${clm.receiptNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject claim.'); }
        },
        async saveExpenseClaim() {
            if (!['Superadmin', 'Director', 'HR', 'Account', 'Staff'].includes(this.userProfile.role)) { this.showNotify('Your role cannot submit expense claims.'); return; }
            if (this.attachmentUploadState.receipt) return this.showNotify('Wait for the receipt upload to finish.');
            Object.assign(this.claimForm, this.normalizeOfficialRecord(this.claimForm));
            this.claimForm.empEmail = String(this.claimForm.empEmail || '').trim().toLowerCase();
            if (!this.claimForm.name || !this.claimForm.empNo || !this.claimForm.amount || !this.claimForm.receiptNo || !this.claimForm.description.trim() || !this.claimForm.receiptAttachment) return this.showNotify("Complete all required claim fields, including Expense Description and Receipt Attachment.");
            try {
                const initialStatus = 'Pending HR';
                const assignee = { id: '', name: 'Human Resource Management', email: '', role: 'HR' };
                const signedInEmail = String(auth.currentUser?.email || this.userProfile.email || '').trim().toLowerCase();
                const canSubmitForOthers = ['Superadmin', 'Director', 'HR', 'Account'].includes(this.userProfile.role);
                const claimOwnerEmail = canSubmitForOthers ? String(this.claimForm.empEmail || signedInEmail).trim().toLowerCase() : signedInEmail;
                if (!auth.currentUser?.uid || !claimOwnerEmail) throw Object.assign(new Error('Your login identity is incomplete. Sign out and sign in again.'), { code: 'permission-denied' });

                const claimId = String(this.editingClaimId || Date.now());
                const payload = { id: claimId, type: 'Claim', documentType: 'Claim', date: this.claimForm.expenseDate, expenseDate: this.claimForm.expenseDate, name: this.claimForm.name, empNo: this.claimForm.empNo, empEmail: claimOwnerEmail, position: this.claimForm.position || '', dept: this.claimForm.dept, category: this.claimForm.category, subCategory: this.claimForm.subCategory, amount: Number(this.claimForm.amount), receiptNo: this.claimForm.receiptNo, description: this.claimForm.description, receiptAttachment: this.claimForm.receiptAttachment, receiptAttachmentName: this.claimForm.receiptAttachmentName || '', receiptAttachmentOriginalBytes: Number(this.claimForm.receiptAttachmentOriginalBytes || 0), createdByUid: this.editingClaimId ? (this.claimForm.createdByUid || auth.currentUser.uid) : auth.currentUser.uid, createdByEmail: this.editingClaimId ? (this.claimForm.createdByEmail || signedInEmail) : signedInEmail, createdAt: this.editingClaimId ? (this.claimForm.createdAt || new Date().toISOString()) : new Date().toISOString(), status: this.editingClaimId ? (this.claimForm.status || initialStatus) : initialStatus, ...this.recordAssignment(this.claimForm, this.editingClaimId, assignee) };
                const previousClaim = this.editingClaimId ? this.claimsHistory.find(item => item.id === claimId) : null;
                const adminCorrection = this.editingClaimId && this.isAdminCorrection(previousClaim || this.claimForm);
                if (adminCorrection) Object.assign(payload, this.adminCorrectionStamp());
                if (this.getSerializedSize(payload) > 800 * 1024) throw Object.assign(new Error('This claim is too large to save. Use fewer or smaller attachments.'), { code: 'resource-exhausted' });
                await setDoc(doc(db, "claims", claimId), payload, { merge: true });
                if (adminCorrection) this.logAudit('UPDATE', `Corrected expense claim ${payload.receiptNo || claimId} for ${payload.name} (${payload.status}).${this.amountChangeNote(previousClaim, payload.amount)}`);
                if (!this.editingClaimId) this.notifyByEmail({
                    to: this.emailsForRole('HR'),
                    subject: `New Expense Claim Pending Review — ${payload.receiptNo}`,
                    heading: 'New Expense Claim Submitted',
                    message: `${payload.name} (${payload.empNo}) submitted an expense claim of ${this.formatCurrency(payload.amount)} for "${payload.category}". It is now pending your review in Claims & Payment Vouchers.`
                });
                this.editingClaimId = null; this.showNotify(`Expense claim submitted.`); this.resetClaimForm();
            } catch (error) { console.error('Claim save failed:', error); this.showNotify(this.getFirestoreWriteError(error, 'submit the claim')); }
        },
        editClaimRecord(clm) { this.claimFormMode = 'Claim'; this.editingClaimId = clm.id; this.selectedClaimEmployeeId = clm.empNo || ''; this.claimForm = JSON.parse(JSON.stringify(clm)); this.switchTab('claims'); },
        cancelEditClaim() { this.editingClaimId = null; this.resetClaimForm(); },
        async printApprovedClaim(claim) {
            if (!claim || claim.status !== 'Approved') { this.showNotify('Only approved claims can be printed.'); return; }
            this.claimPrint = JSON.parse(JSON.stringify(claim));
            this.activePrintModule = 'CLAIM';
            this.setPrintOrientation('portrait', '15mm');
            await this.$nextTick();
            window.print();
        },

        // ================================================================
        // PAYMENT VOUCHER FLOW — dedicated end-to-end pipeline for 'payment_vouchers' collection
        // WORKFLOW: Staff/Client -> HR -> Account -> Director (final approval), independent of Expense Claims
        // ================================================================
        canApprovePaymentVoucher(pv) {
            const role = this.userProfile.role;
            if (this.isFullAccessRole) return typeof pv.status === 'string' && pv.status.startsWith('Pending');
            const expectedStatus = { HR: 'Pending HR', Account: 'Pending Account', Director: 'Pending Director' }[role];
            return !!expectedStatus && pv.status === expectedStatus && (!pv.assignedToEmail || pv.assignedToEmail === this.userProfile.email);
        },
        canEditPaymentVoucher(pv) {
            return this.isFullAccessRole || this.isOwnPendingRecord(pv);
        },
        async approvePaymentVoucher(pv) {
            if (!this.canApprovePaymentVoucher(pv)) { this.showNotify('You do not have permission to approve this record at its current workflow stage.'); return false; }
            if (this.attachmentUploadState.director) { this.showNotify('Wait for the Director approval document upload to finish.'); return false; }
            const isDirectorDecision = this.isFullAccessRole;
            const nextRole = isDirectorDecision ? null : { 'Pending HR': 'Account', 'Pending Account': 'Director' }[pv.status];
            const roleNames = { HR: 'Human Resource Management', Account: 'Finance Account Management', Director: 'Director' };
            if (isDirectorDecision && !this.claimPreview.directorApprovalAttachment) { this.showNotify('Director approval requires a supporting document attachment.'); return; }
            const bypassedReviews = pv.status === 'Pending HR' ? ['HR', 'Account'] : pv.status === 'Pending Account' ? ['Account'] : [];
            const nowIso = new Date().toISOString();
            const existingHistory = Array.isArray(pv.approvalHistory) ? pv.approvalHistory : [];
            const bypassEntries = bypassedReviews.map(role => ({ role, roleName: roleNames[role] || role, bypassed: true, note: 'Bypassed by Director direct approval', recordedAt: nowIso }));
            const approvalHistory = [
                ...existingHistory,
                ...bypassEntries,
                { role: this.userProfile.role, roleName: roleNames[this.userProfile.role] || this.userProfile.role, approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedAt: nowIso }
            ];
            const update = nextRole
                ? { status: `Pending ${nextRole}`, assignedToUid: '', assignedToName: roleNames[nextRole], assignedToEmail: '', assignedToRole: nextRole, approvalHistory }
                : { status: 'Approved', finalDecision: true, settlementStatus: 'Paid', statusDetail: 'Payment fully paid', approvalPath: 'Director Direct Approval', approvalPreviousStatus: pv.status, bypassedReviews, assignedToUid: this.userProfile.uid, assignedToName: this.userProfile.name, assignedToEmail: this.userProfile.email, assignedToRole: 'Director', approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedByRole: 'Director', approvedAt: nowIso, directorApprovalAttachment: this.claimPreview.directorApprovalAttachment, directorApprovalAttachmentName: this.claimPreview.directorApprovalAttachmentName, directorApprovalOriginalBytes: Number(this.claimPreview.directorApprovalOriginalBytes || 0), approvalHistory };
            try {
                if (!nextRole && this.getSerializedSize({ ...pv, ...update }) > 800 * 1024) throw Object.assign(new Error('This voucher is too large to save with its attachments. Use fewer or smaller files.'), { code: 'resource-exhausted' });
                await updateDoc(doc(db, "payment_vouchers", pv.id), update);
                this.logAudit('UPDATE', `Payment Voucher ${pv.voucherNo} ${nextRole ? `forwarded to ${roleNames[nextRole]}` : `directly and finally approved by Director${bypassedReviews.length ? ` (bypassed ${bypassedReviews.join(' and ')})` : ''}`}`);
                this.showNotify(nextRole ? `Voucher assigned to ${roleNames[nextRole]}.` : 'Director approval completed immediately. No further HR or Finance review is required.');
                if (nextRole) this.notifyByEmail({
                    to: this.emailsForRole(nextRole),
                    subject: `Payment Voucher Pending Your Review — ${pv.voucherNo}`,
                    heading: 'Payment Voucher Forwarded To You',
                    message: `${pv.name}'s payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) payable to "${pv.payeeName}" was approved by ${roleNames[this.userProfile.role]} and is now pending your review.`
                }); else this.notifyByEmail({
                    to: pv.empEmail,
                    subject: `Your Payment Voucher Was Approved — ${pv.voucherNo}`,
                    heading: 'Payment Voucher Approved',
                    message: `Your payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) has been fully approved by the Director. No further action is needed on your part.`
                });
                return true;
            } catch (error) {
                console.error('Voucher approval failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'update the voucher status'));
                return false;
            }
        },
        async approvePaymentVoucherFromPreview() {
            const approved = await this.approvePaymentVoucher(this.claimPreview.claim);
            if (approved) this.claimPreview.show = false;
        },
        async rejectPaymentVoucher(pv) {
            if (!this.canApprovePaymentVoucher(pv)) { this.showNotify('You do not have permission to reject this record at its current workflow stage.'); return; }
            if (!await this.askConfirm({
                title: 'Reject this payment voucher?',
                message: `Voucher ${pv.voucherNo} for ${this.formatCurrency(pv.amount)} will be rejected and the requester notified by email.`,
                confirmLabel: 'Yes, Reject Voucher',
                danger: true
            })) return;
            try { await updateDoc(doc(db, "payment_vouchers", pv.id), { status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString() }); this.showNotify("Payment voucher rejected."); this.notifyByEmail({ to: pv.empEmail, subject: `Your Payment Voucher Was Rejected — ${pv.voucherNo}`, heading: 'Payment Voucher Rejected', message: `Your payment voucher of ${this.formatCurrency(pv.amount)} (${pv.voucherNo}) was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.` }); } catch (error) { this.showNotify('Unable to reject voucher.'); }
        },
        async savePaymentVoucher() {
            if (!['Superadmin', 'Director', 'HR', 'Account', 'Staff'].includes(this.userProfile.role)) { this.showNotify('Your role cannot submit payment vouchers.'); return; }
            if (this.attachmentUploadState.receipt) return this.showNotify('Wait for the supporting document upload to finish.');
            Object.assign(this.voucherForm, this.normalizeOfficialRecord(this.voucherForm));
            this.voucherForm.empEmail = String(this.voucherForm.empEmail || '').trim().toLowerCase();
            if (!this.voucherForm.name || !this.voucherForm.empNo || !this.voucherForm.amount || !this.voucherForm.description.trim() || !this.voucherForm.receiptAttachment) return this.showNotify("Complete all required voucher fields, including Payment Description and Supporting Document.");
            if (!this.voucherForm.payeeName.trim() || !this.voucherForm.paymentPurpose.trim()) return this.showNotify('Complete the Payee Name and Payment Purpose for this Payment Voucher.');
            try {
                const initialStatus = 'Pending HR';
                const assignee = { id: '', name: 'Human Resource Management', email: '', role: 'HR' };
                const signedInEmail = String(auth.currentUser?.email || this.userProfile.email || '').trim().toLowerCase();
                const canSubmitForOthers = ['Superadmin', 'Director', 'HR', 'Account'].includes(this.userProfile.role);
                const voucherOwnerEmail = canSubmitForOthers ? String(this.voucherForm.empEmail || signedInEmail).trim().toLowerCase() : signedInEmail;
                if (!auth.currentUser?.uid || !voucherOwnerEmail) throw Object.assign(new Error('Your login identity is incomplete. Sign out and sign in again.'), { code: 'permission-denied' });

                const voucherId = String(this.editingVoucherId || Date.now());
                if (!this.voucherForm.voucherNo) this.voucherForm.voucherNo = `PV-${this.currentYear}-${String(Date.now()).slice(-6)}`;
                const payload = { id: voucherId, type: 'Payment Voucher', documentType: 'Payment Voucher', date: this.voucherForm.paymentDate, paymentDate: this.voucherForm.paymentDate, name: this.voucherForm.name, empNo: this.voucherForm.empNo, empEmail: voucherOwnerEmail, position: this.voucherForm.position || '', dept: this.voucherForm.dept, payeeName: this.voucherForm.payeeName, payeeType: this.voucherForm.payeeType || '', payeeReference: this.voucherForm.payeeReference || '', paymentPurpose: this.voucherForm.paymentPurpose, category: this.voucherForm.category, subCategory: this.voucherForm.subCategory, amount: Number(this.voucherForm.amount), voucherNo: this.voucherForm.voucherNo, description: this.voucherForm.description, receiptAttachment: this.voucherForm.receiptAttachment, receiptAttachmentName: this.voucherForm.receiptAttachmentName || '', receiptAttachmentOriginalBytes: Number(this.voucherForm.receiptAttachmentOriginalBytes || 0), createdByUid: this.editingVoucherId ? (this.voucherForm.createdByUid || auth.currentUser.uid) : auth.currentUser.uid, createdByEmail: this.editingVoucherId ? (this.voucherForm.createdByEmail || signedInEmail) : signedInEmail, createdAt: this.editingVoucherId ? (this.voucherForm.createdAt || new Date().toISOString()) : new Date().toISOString(), status: this.editingVoucherId ? (this.voucherForm.status || initialStatus) : initialStatus, ...this.recordAssignment(this.voucherForm, this.editingVoucherId, assignee) };
                const previousVoucher = this.editingVoucherId ? this.paymentVouchers.find(item => item.id === voucherId) : null;
                const adminCorrection = this.editingVoucherId && this.isAdminCorrection(previousVoucher || this.voucherForm);
                if (adminCorrection) Object.assign(payload, this.adminCorrectionStamp());
                if (this.getSerializedSize(payload) > 800 * 1024) throw Object.assign(new Error('This voucher is too large to save. Use fewer or smaller attachments.'), { code: 'resource-exhausted' });
                await setDoc(doc(db, "payment_vouchers", voucherId), payload, { merge: true });
                if (adminCorrection) this.logAudit('UPDATE', `Corrected payment voucher for ${payload.payeeName || payload.name} (${payload.status}).${this.amountChangeNote(previousVoucher, payload.amount)}`);
                if (!this.editingVoucherId) this.notifyByEmail({
                    to: this.emailsForRole('HR'),
                    subject: `New Payment Voucher Pending Review — ${payload.voucherNo}`,
                    heading: 'New Payment Voucher Submitted',
                    message: `${payload.name} (${payload.empNo}) submitted a payment voucher of ${this.formatCurrency(payload.amount)} payable to "${payload.payeeName}". It is now pending your review in Claims & Payment Vouchers.`
                });
                this.editingVoucherId = null; this.showNotify(`Payment voucher submitted.`); this.resetVoucherForm();
            } catch (error) { console.error('Voucher save failed:', error); this.showNotify(this.getFirestoreWriteError(error, 'submit the payment voucher')); }
        },
        editPaymentVoucher(pv) { this.claimFormMode = 'Payment Voucher'; this.editingVoucherId = pv.id; this.selectedVoucherEmployeeId = pv.empNo || ''; this.voucherForm = JSON.parse(JSON.stringify(pv)); this.switchTab('claims'); },
        cancelEditVoucher() { this.editingVoucherId = null; this.resetVoucherForm(); },
        async printApprovedVoucher(voucher) {
            if (!voucher || voucher.status !== 'Approved') { this.showNotify('Only approved payment vouchers can be printed.'); return; }
            this.claimPrint = JSON.parse(JSON.stringify(voucher));
            this.activePrintModule = 'CLAIM';
            this.setPrintOrientation('portrait', '15mm');
            await this.$nextTick();
            window.print();
        }
};