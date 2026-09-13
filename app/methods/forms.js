// Blank-slate form resets and the portal's own confirmation dialogs.
export const formMethods = {

        resetAllForms() {
            this.selectedPayEmployeeId = '';
            this.selectedClaimEmployeeId = '';
            this.selectedVoucherEmployeeId = '';
            this.docForm = {
                type: 'Invoice', docNo: '', status: 'Unpaid', paymentMethod: 'Bank Transfer (EFT)', paymentBank: '', paymentReceiver: '', paymentRefNo: '', paymentAttachment: '',
                date: new Date().toISOString().substr(0, 10), dueDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().substr(0, 10),
                customerId: '', projectId: '', projectRef: '', projectTitle: '', sourceQuotationId: '', sourceQuotationNo: '', clientName: '', clientPhone: '', clientSSM: '', clientAddress: '', clientAddress1: '', clientAddress2: '', clientAddress3: '', clientCity: '', clientState: '', clientPostcode: '', clientCountry: 'Malaysia', clientEmail: '', clientContactPerson: '', clientPosition: '', additionalClientEmailsText: '',
                items: [{ desc: '', qty: 1, price: 0 }], discount: 0
            };
            this.payForm = {
                name: '', ic: '', empNo: '', empEmail: '', position: '', dept: '', isSenior: false, joinDate: '', bankAcc: '', epfSocso: '',
                month: new Date().toISOString().slice(0, 7), payDate: new Date().toISOString().slice(0, 10),
                basic: 0, ot: 0, phone: 0, transport: 0, meal: 0, bonus: 0, dedEpf: 0, dedSocso: 0, dedSkbbk: 0, dedEis: 0, dedPcb: 0, dedAdvance: 0, dedOther: 0,
                skbbkOptedOut: false, statutoryOverride: false, statutoryOverrideReason: ''
            };
            this.claimForm = {
                documentType: 'Claim', name: '', empNo: '', empEmail: '', position: '', dept: '', expenseDate: new Date().toISOString().substr(0, 10), category: 'Medical', subCategory: 'Clinic / Hospital Treatment',
                payeeName: '', payeeType: 'Individual', payeeReference: '', paymentPurpose: '',
                amount: 0, receiptNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            };
            this.voucherForm = {
                documentType: 'Payment Voucher', name: '', empNo: '', empEmail: '', position: '', dept: '', paymentDate: new Date().toISOString().substr(0, 10), category: 'Vendor and Supplier', subCategory: 'Supplier Invoice Payment',
                payeeName: '', payeeType: 'Vendor / Supplier', payeeReference: '', paymentPurpose: '',
                amount: 0, voucherNo: '', description: '', receiptAttachment: '', receiptAttachmentName: '', receiptAttachmentOriginalBytes: 0, status: 'Pending HR',
                assignedToUid: '', assignedToName: '', assignedToEmail: '', assignedToRole: 'HR'
            };
            this.clientSavedForDocument = false;
            this.editingDocId = null; this.editingPayId = null; this.editingClaimId = null; this.editingVoucherId = null;
            this.autoCalculatePayroll();
            this.generateDocNo();
        },
        // noteLabel turns on a free-text field inside the dialog — used where a
        // decision is worth recording a reason for, not just a yes or no.
        requestConfirm({ title, message, confirmLabel = 'Yes, Continue', danger = false, noteLabel = '', notePlaceholder = '', onConfirm = null, onResolve = null }) {
            this.appConfirm = { show: true, title, message, confirmLabel, danger, noteLabel, notePlaceholder, note: '', onConfirm, onResolve };
        },
        // Promise-returning form of requestConfirm, for `if (!await this.askConfirm(…)) return;`.
        // The native confirm() this replaces blocks the main thread for as long as the
        // dialog stays open, and Chrome bills that whole stretch to the originating
        // click, so a destructive action measured over a second of INP.
        askConfirm(options) {
            return new Promise(resolve => this.requestConfirm({ ...options, onResolve: resolve }));
        },
        // Same dialog, but hands back what was typed alongside the answer.
        askConfirmWithNote(options) {
            return new Promise(resolve => this.requestConfirm({
                ...options,
                onResolve: (confirmed, note) => resolve({ confirmed, note })
            }));
        },
        resolveAppConfirm(confirmed) {
            const { onConfirm, onResolve, note } = this.appConfirm;
            this.appConfirm = { show: false, title: '', message: '', confirmLabel: 'Yes, Continue', danger: false, noteLabel: '', notePlaceholder: '', note: '', onConfirm: null, onResolve: null };
            if (confirmed && typeof onConfirm === 'function') onConfirm();
            // Always settle a pending askConfirm — cancelling, dismissing the overlay
            // and the Escape handler all route here, and an unsettled promise would
            // strand the caller mid-action.
            if (typeof onResolve === 'function') onResolve(confirmed, String(note || '').trim());
        },
        clearAllDocItems() {
            this.requestConfirm({
                title: 'Clear all items?',
                message: 'This removes every product/service line from this document.',
                confirmLabel: 'Yes, Clear Items',
                danger: true,
                onConfirm: () => { this.docForm.items = [{ desc: '', qty: 1, price: 0 }]; this.showNotify("All items cleared."); }
            });
        },
        resetDocForm() {
            this.requestConfirm({
                title: 'Clear the entire form?',
                message: 'This removes all client information and items entered so far.',
                confirmLabel: 'Yes, Clear Form',
                danger: true,
                onConfirm: () => { this.resetAllForms(); this.showNotify("Form cleared."); }
            });
        },
        resetPayForm() {
            this.requestConfirm({
                title: 'Clear the entire payslip form?',
                message: 'This removes all payslip details entered so far.',
                confirmLabel: 'Yes, Clear Form',
                danger: true,
                onConfirm: () => { this.editingPayId = null; this.resetAllForms(); this.showNotify("Form cleared."); }
            });
        },
        resetClaimForm() {
            this.editingClaimId = null; this.resetAllForms();
        },
        resetVoucherForm() {
            this.editingVoucherId = null; this.resetAllForms();
        }
};