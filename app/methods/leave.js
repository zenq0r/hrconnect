// Leave requests: single-stage approval (Staff -> HR), unlike Claims' three
// stages — leave is not a financial record, so Account plays no role in it.
// Superadmin/Director may decide directly or correct any request afterwards,
// the same escape hatch Claims gives them.
import {
    db,
    auth,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "../../firebase-config.js";
export const leaveMethods = {

        resetLeaveForm() {
            this.editingLeaveId = null;
            this.selectedLeaveEmployeeId = '';
            this.leaveForm = { id: '', empNo: '', name: '', empEmail: '', position: '', dept: '', leaveType: 'Annual', startDate: '', endDate: '', totalDays: 1, reason: '' };
        },
        selectEmployeeForLeave(e) {
            const emp = this.employees.find(x => x.empNo === e.target.value);
            if (emp) { this.leaveForm.name = emp.name || ''; this.leaveForm.empNo = emp.empNo || ''; this.leaveForm.empEmail = String(emp.email || '').trim().toLowerCase(); this.leaveForm.position = emp.position || ''; this.leaveForm.dept = emp.dept || ''; this.showNotify('Applicant loaded.'); }
        },
        // Inclusive calendar-day count. Deliberately simple — it does not
        // exclude weekends or public holidays, matching the scope of this
        // first version of the workflow.
        recalculateLeaveDays() {
            const start = new Date(`${this.leaveForm.startDate}T00:00:00`);
            const end = new Date(`${this.leaveForm.endDate}T00:00:00`);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) { this.leaveForm.totalDays = 0; return; }
            this.leaveForm.totalDays = Math.round((end - start) / 86400000) + 1;
        },
        editLeaveRequest(record) {
            this.editingLeaveId = record.id;
            this.selectedLeaveEmployeeId = record.empNo || '';
            this.leaveForm = { id: record.id, empNo: record.empNo, name: record.name, empEmail: record.empEmail, position: record.position || '', dept: record.dept || '', leaveType: record.leaveType, startDate: record.startDate, endDate: record.endDate, totalDays: record.totalDays, reason: record.reason };
        },
        cancelEditLeaveRequest() { this.resetLeaveForm(); },
        async saveLeaveRequest() {
            if (!['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff'].includes(this.userProfile.role)) { this.showNotify('Your role cannot submit leave requests.'); return; }
            const form = this.leaveForm;
            this.recalculateLeaveDays();
            if (!form.name || !form.empNo || !form.startDate || !form.endDate || !form.reason.trim()) return this.showNotify('Complete the applicant, dates and reason before submitting.');
            if (form.totalDays <= 0) return this.showNotify('End date must be on or after the start date.');
            try {
                const signedInEmail = String(auth.currentUser?.email || this.userProfile.email || '').trim().toLowerCase();
                const canSubmitForOthers = ['Superadmin', 'Director', 'HR', 'Account'].includes(this.userProfile.role);
                const applicantEmail = canSubmitForOthers ? String(form.empEmail || signedInEmail).trim().toLowerCase() : signedInEmail;
                if (!auth.currentUser?.uid || !applicantEmail) throw Object.assign(new Error('Your login identity is incomplete. Sign out and sign in again.'), { code: 'permission-denied' });

                const leaveId = String(this.editingLeaveId || Date.now());
                const existing = this.editingLeaveId ? this.leaveRequests.find(item => item.id === leaveId) : null;
                const payload = {
                    id: leaveId, empNo: form.empNo, name: form.name, empEmail: applicantEmail, position: form.position || '', dept: form.dept || '',
                    leaveType: form.leaveType, startDate: form.startDate, endDate: form.endDate, totalDays: form.totalDays, reason: form.reason.trim(),
                    status: this.editingLeaveId ? (existing?.status || 'Pending HR') : 'Pending HR',
                    createdByUid: this.editingLeaveId ? (existing?.createdByUid || auth.currentUser.uid) : auth.currentUser.uid,
                    createdByEmail: this.editingLeaveId ? (existing?.createdByEmail || signedInEmail) : signedInEmail,
                    createdAt: this.editingLeaveId ? (existing?.createdAt || new Date().toISOString()) : new Date().toISOString()
                };
                await setDoc(doc(db, 'leave_requests', leaveId), payload, { merge: true });
                if (!this.editingLeaveId) {
                    this.logAudit('CREATE', `Submitted a ${payload.leaveType} leave request for ${payload.name} (${payload.startDate} to ${payload.endDate})`);
                    this.notifyByEmail({
                        to: this.emailsForRole('HR'),
                        subject: `New Leave Request Pending Review — ${payload.name}`,
                        heading: 'New Leave Request Submitted',
                        message: `${payload.name} (${payload.empNo}) requested ${payload.totalDays} day(s) of ${payload.leaveType} leave, from ${payload.startDate} to ${payload.endDate}. It is now pending your review in Leave Requests.`
                    });
                } else {
                    this.logAudit('UPDATE', `Updated leave request ${leaveId} for ${payload.name}`);
                }
                this.showNotify(this.editingLeaveId ? 'Leave request updated.' : 'Leave request submitted.');
                this.resetLeaveForm();
            } catch (error) {
                console.error('Leave request save failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'submit the leave request'));
            }
        },
        canDecideLeaveRequest(record) {
            return record.status === 'Pending HR' && (this.isFullAccessRole || this.userProfile.role === 'HR');
        },
        canEditLeaveRequest(record) {
            if (this.isFullAccessRole) return true;
            const own = String(record.empEmail || '').trim().toLowerCase() === String(this.userProfile.email || '').trim().toLowerCase();
            return own && record.status === 'Pending HR';
        },
        async approveLeaveRequest(record) {
            if (!this.canDecideLeaveRequest(record)) { this.showNotify('You do not have permission to decide this leave request.'); return; }
            try {
                await updateDoc(doc(db, 'leave_requests', record.id), {
                    status: 'Approved', approvedByUid: this.userProfile.uid, approvedByName: this.userProfile.name, approvedByEmail: this.userProfile.email, approvedByRole: this.userProfile.role, approvedAt: new Date().toISOString()
                });
                this.logAudit('UPDATE', `Approved leave request ${record.id} for ${record.name}`);
                this.showNotify('Leave request approved.');
                this.notifyByEmail({
                    to: record.empEmail,
                    subject: `Your Leave Request Was Approved — ${record.startDate} to ${record.endDate}`,
                    heading: 'Leave Request Approved',
                    message: `Your ${record.leaveType} leave request from ${record.startDate} to ${record.endDate} (${record.totalDays} day(s)) has been approved by ${this.getRoleDisplayName(this.userProfile.role)}.`
                });
            } catch (error) {
                console.error('Leave approval failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'approve this leave request'));
            }
        },
        async rejectLeaveRequest(record) {
            if (!this.canDecideLeaveRequest(record)) { this.showNotify('You do not have permission to decide this leave request.'); return; }
            if (!await this.askConfirm({
                title: 'Reject this leave request?',
                message: `${record.name}'s ${record.leaveType} leave request (${record.startDate} to ${record.endDate}) will be rejected and the applicant notified by email.`,
                confirmLabel: 'Yes, Reject Request',
                danger: true
            })) return;
            try {
                await updateDoc(doc(db, 'leave_requests', record.id), {
                    status: 'Rejected', rejectedByUid: this.userProfile.uid, rejectedByName: this.userProfile.name, rejectedByRole: this.userProfile.role, rejectedAt: new Date().toISOString()
                });
                this.logAudit('UPDATE', `Rejected leave request ${record.id} for ${record.name}`);
                this.showNotify('Leave request rejected.');
                this.notifyByEmail({
                    to: record.empEmail,
                    subject: `Your Leave Request Was Rejected — ${record.startDate} to ${record.endDate}`,
                    heading: 'Leave Request Rejected',
                    message: `Your ${record.leaveType} leave request from ${record.startDate} to ${record.endDate} was rejected by ${this.getRoleDisplayName(this.userProfile.role)}. Contact them for details.`
                });
            } catch (error) {
                console.error('Leave rejection failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'reject this leave request'));
            }
        },
        openLeaveCorrectionModal(record) {
            if (!this.isFullAccessRole) { this.showNotify('Only Superadmin and Director can correct a leave request.'); return; }
            this.leaveCorrectionModal = { show: true, record: { ...record }, correctionNote: '' };
        },
        async saveLeaveCorrection() {
            const { record, correctionNote } = this.leaveCorrectionModal;
            if (!record) return;
            if (!correctionNote.trim()) { this.showNotify('Explain the correction before saving.'); return; }
            if (!record.startDate || !record.endDate || !record.reason.trim()) { this.showNotify('Complete the dates and reason.'); return; }
            const start = new Date(`${record.startDate}T00:00:00`);
            const end = new Date(`${record.endDate}T00:00:00`);
            const totalDays = (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) ? 0 : Math.round((end - start) / 86400000) + 1;
            if (totalDays <= 0) { this.showNotify('End date must be on or after the start date.'); return; }
            try {
                await updateDoc(doc(db, 'leave_requests', record.id), {
                    leaveType: record.leaveType, startDate: record.startDate, endDate: record.endDate, totalDays,
                    reason: record.reason.trim(), name: record.name, position: record.position || '', dept: record.dept || '', empEmail: record.empEmail,
                    lastEditedByUid: this.userProfile.uid, lastEditedByName: this.userProfile.name, lastEditedAt: new Date().toISOString()
                });
                this.logAudit('UPDATE', `Corrected leave request ${record.id} for ${record.name}: ${correctionNote.trim()}`);
                this.showNotify('Leave request corrected.');
                this.leaveCorrectionModal = { show: false, record: null, correctionNote: '' };
            } catch (error) {
                console.error('Leave correction failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'correct this leave request'));
            }
        },
        async deleteLeaveRequest(record) {
            if (!this.canDelete) { this.showNotify('Only Superadmin and Director can delete a leave request.'); return; }
            if (!await this.askConfirm({
                title: 'Delete this leave request?',
                message: `${record.name}'s ${record.leaveType} leave request (${record.startDate} to ${record.endDate}) will be permanently deleted.`,
                confirmLabel: 'Yes, Delete',
                danger: true
            })) return;
            try {
                await deleteDoc(doc(db, 'leave_requests', record.id));
                this.logAudit('DELETE', `Deleted leave request ${record.id} for ${record.name}`);
                this.showNotify('Leave request deleted.');
            } catch (error) {
                console.error('Leave request delete failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'delete this leave request'));
            }
        }
};
