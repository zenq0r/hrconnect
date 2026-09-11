// Quotations, invoices and payslips: building a document, printing it, and the
// billing workflow actions on a saved record.
import {
    db,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "../../firebase-config.js";
import { STATUTORY_RATES } from "../constants/statutory.js";
export const billingMethods = {

        loadCustomerIntoDocument(cust) {
            if (!cust?.id) return;
            const previousCustomerId = this.docForm.customerId || '';
            const switchedCompany = previousCustomerId !== cust.id;
            const clientFields = ['clientId', 'clientName', 'clientPhone', 'clientSSM', 'clientAddress', 'clientAddress1', 'clientAddress2', 'clientAddress3', 'clientCity', 'clientState', 'clientPostcode', 'clientEmail', 'clientContactPerson', 'clientPosition'];

            // Assign every client field explicitly, including empty values. This
            // prevents an optional field from the previous company leaking into the
            // document for the newly selected company.
            clientFields.forEach(field => { this.docForm[field] = cust[field] || ''; });
            this.docForm.clientAddress1 = cust.clientAddress1 || cust.clientAddress || '';
            this.docForm.clientAddress = cust.clientAddress || this.docForm.clientAddress1;
            this.docForm.clientCountry = cust.clientCountry || 'Malaysia';
            this.docForm.customerId = cust.id;
            this.docForm.additionalClientEmailsText = Array.isArray(cust.additionalClientEmails) ? cust.additionalClientEmails.join(', ') : '';
            // A quotation is tied to the delivery project so its acceptance can
            // create a deterministic handover to that project's assigned PIC.
            if (switchedCompany) {
                this.docForm.projectId = '';
                this.docForm.projectRef = '';
                this.docForm.projectTitle = '';
            }
            this.clientSavedForDocument = true;

            // A saved document must never be overwritten just because the user
            // switches to another company to prepare the next one. Keep the entered
            // line items and payment details, but start a fresh document identity.
            if (switchedCompany && this.editingDocId) {
                this.editingDocId = null;
                this.generateDocNo(true);
                this.showNotify('New client loaded. A new document number was prepared; line items were kept.');
                return;
            }
            this.showNotify('Saved client loaded. You can continue with the current document items.');
        },
        selectCustomerForDoc(e) {
            const cust = this.customers.find(c => c.id === e.target.value);
            if (cust) {
                this.loadCustomerIntoDocument(cust);
            } else {
                this.docForm.customerId = '';
                this.docForm.projectId = '';
                this.docForm.projectRef = '';
                this.docForm.projectTitle = '';
                this.docForm.additionalClientEmailsText = '';
                this.clientSavedForDocument = false;
            }
        },
        selectProjectForDoc(e) {
            const project = this.documentProjectsForSelectedClient.find(item => item.id === e.target.value);
            this.docForm.projectId = project?.id || '';
            this.docForm.projectRef = project?.projectRef || '';
            this.docForm.projectTitle = project?.title || '';
        },

        setPrintOrientation(orientation, margin) { const styleEl = document.getElementById('dynamic-print-orientation'); if (styleEl) styleEl.innerHTML = `@media print { @page { size: A4 ${orientation}; margin: ${margin} !important; } }`; },
        async printDocumentModule() { if (!this.clientSavedForDocument) return this.showNotify('Select a registered client before previewing or printing this document.'); this.activePrintModule = this.docForm.type === 'Quotation' ? 'QUOTATION' : 'INVOICE'; this.setPrintOrientation('portrait', '15mm'); setTimeout(() => { window.print(); }, 250); },
        async printPayslipModule() { if (!this.payForm.name || !this.payForm.empNo) return this.showNotify('Enter Name and Emp ID.'); this.autoCalculatePayroll(); this.activePrintModule = 'PAYSLIP'; this.setPrintOrientation('landscape', '0mm'); setTimeout(() => { window.print(); }, 250); },
        createInvoiceFromQuotation(quotation) {
            if (!this.canManageBillingWorkflow || quotation?.type !== 'Quotation' || quotation.status !== 'Accepted') {
                this.showNotify('Only a Director or Superadmin can prepare an invoice from an accepted quotation.', 'error'); return;
            }
            const source = JSON.parse(JSON.stringify(quotation.raw || {}));
            this.editingDocId = null;
            this.docForm = {
                ...source,
                type: 'Invoice',
                docNo: '',
                status: 'Draft',
                paymentRefNo: '',
                paymentAttachment: '',
                sourceQuotationId: quotation.id,
                sourceQuotationNo: quotation.docNo || '',
                date: new Date().toISOString().substr(0, 10),
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().substr(0, 10)
            };
            this.clientSavedForDocument = Boolean(this.docForm.customerId);
            this.generateDocNo();
            this.switchTab('document-quotations');
            this.showNotify(`Invoice draft prepared from ${quotation.docNo}. Review it, then Save as Draft or Send to Client.`);
        },
        async reviewPaymentProof(invoice, approved) {
            if (!this.canVerifyPaymentProof || !invoice?.paymentProofUrl) { this.showNotify('Only HR Management or Finance can verify a payment proof.', 'error'); return; }
            const { confirmed, note } = await this.askConfirmWithNote({
                title: approved ? 'Verify this payment?' : 'Reject this payment proof?',
                message: approved
                    ? `${invoice.docNo} will be marked Paid. The client, PIC and Director will be notified.`
                    : `${invoice.docNo} stays Unpaid. The client will be asked to upload a corrected proof.`,
                confirmLabel: approved ? 'Verify and Mark Paid' : 'Reject Proof',
                danger: !approved,
                noteLabel: approved ? 'Verification note (optional)' : 'Reason for rejection',
                notePlaceholder: approved ? 'Reference checked by Finance' : 'Explain what the client needs to correct'
            });
            if (!confirmed) return;
            try {
                await this.runBillingWorkflow('payment-proof-reviewed', invoice.id, { decision: approved ? 'approved' : 'rejected', note });
                this.logAudit('UPDATE', `${approved ? 'Verified' : 'Rejected'} payment proof for ${invoice.docNo}`);
                this.showNotify(approved ? `${invoice.docNo} is marked Paid.` : `Payment proof for ${invoice.docNo} was rejected; client has been notified.`);
            } catch (error) {
                console.error('Payment proof review failed:', error);
                this.showNotify(error.message || 'Unable to review the payment proof.', 'error');
            }
        },
        async discardInvoiceDraft(invoice) {
            if (!this.canDeleteBillingDocument(invoice) || invoice?.type !== 'Invoice' || invoice.status !== 'Draft') {
                this.showNotify('Only Director, Finance or Superadmin can discard an unsent invoice draft.', 'error'); return;
            }
            if (!await this.askConfirm({ title: 'Discard invoice draft?', message: `${invoice.docNo} has not been sent to the client and will be permanently removed.`, confirmLabel: 'Discard Draft', danger: true })) return;
            try {
                await deleteDoc(doc(db, 'docs', invoice.id));
                this.logAudit('DELETE', `Discarded unsent invoice draft ${invoice.docNo}`);
                this.showNotify('Invoice draft discarded.');
            } catch (error) {
                console.error('Invoice draft discard failed:', error);
                this.showNotify('Unable to discard this invoice draft.', 'error');
            }
        },
        async deleteInvoiceFromWorkflow(invoice) {
            if (!this.canDeleteBillingDocument(invoice) || invoice?.type !== 'Invoice') {
                this.showNotify('Only Director, Finance or Superadmin can delete an invoice.', 'error'); return;
            }
            if (!await this.askConfirm({ title: 'Delete invoice?', message: `${invoice.docNo} will be permanently removed. This can affect the Client document history.`, confirmLabel: 'Delete Invoice', danger: true })) return;
            try {
                await deleteDoc(doc(db, 'docs', invoice.id));
                this.logAudit('DELETE', `Deleted invoice ${invoice.docNo} from Client Billing Workflow`);
                this.showNotify('Invoice deleted.');
            } catch (error) {
                console.error('Invoice delete failed:', error);
                this.showNotify('Unable to delete this invoice.', 'error');
            }
        },
        
        async saveDocRecord() {
            try {
                if (this.attachmentUploadState.payment) { this.showNotify('Wait for the payment attachment upload to finish.'); return false; }
                if (!this.canManageDocuments) { this.showNotify('You do not have permission to save documents.'); return false; }
                if (['Paid', 'Partial'].includes(this.docForm.status) && (!this.docForm.paymentRefNo || this.docForm.paymentRefNo.trim() === '')) { this.showNotify("Payment Reference No. is REQUIRED."); return false; }
                const normalizedDocForm = this.normalizeOfficialRecord(this.docForm);
                normalizedDocForm.clientEmail = String(this.docForm.clientEmail || '').trim().toLowerCase();
                Object.assign(this.docForm, normalizedDocForm);
                const docId = String(this.editingDocId || Date.now());
                const linkedProject = this.projects.find(project => String(project.id || '') === String(this.docForm.projectId || ''));
                const payload = { id: docId, type: this.docForm.type, docNo: this.docForm.docNo, status: this.docForm.status || (this.docForm.type === 'Invoice' ? 'Unpaid' : 'Open'), paymentMethod: this.docForm.paymentMethod || 'Bank Transfer', paymentBank: this.docForm.paymentBank || '', paymentReceiver: this.docForm.paymentReceiver || '', paymentRefNo: this.docForm.paymentRefNo || '', paymentAttachment: this.docForm.paymentAttachment || '', date: this.docForm.date, name: this.docForm.clientName, amount: this.docGrandTotal, billingClientId: String(this.docForm.customerId || '').trim(), billingProjectId: String(this.docForm.projectId || '').trim(), billingPicEmail: String(linkedProject?.ownerEmail || '').trim().toLowerCase(), raw: JSON.parse(JSON.stringify(this.docForm)) };
                if (!this.clientSavedForDocument) { this.showNotify('Select a registered client before saving this document.'); return false; }
                // Hard guarantee, not just an implied one: every document must carry
                // its client's real customers/{id}, never just a name snapshot — two
                // clients can share a display name, and a name can be retyped/edited
                // later, but the id never changes. clientSavedForDocument being true
                // should already make this impossible to hit (selectCustomerForDoc
                // always sets docForm.customerId first), so this is a defensive
                // backstop, not the primary mechanism.
                if (!payload.raw.customerId) { this.showNotify('This document is missing its linked client ID — reselect a client from Client Information before saving this document.'); return false; }
                if (['Quotation', 'Invoice'].includes(payload.type) && !payload.raw.projectId) { this.showNotify('Select the exact assigned project/PIC before saving this billing document.'); return false; }
                if (['Quotation', 'Invoice'].includes(payload.type) && String(linkedProject?.clientDirectoryId || '') !== String(payload.raw.customerId || '')) { this.showNotify('The selected project belongs to a different Client ID. Select a project under the current Client before saving.'); return false; }
                const previous = this.docHistory.find(item => item.id === docId);
                const isQuotationBeingIssued = payload.type === 'Quotation' && payload.status === 'Open' && (!previous || !previous.quotationIssuedAt);
                const isInvoiceBeingSent = payload.type === 'Invoice' && payload.status === 'Unpaid' && (!previous || previous.status === 'Draft' || !previous.invoiceSentAt);
                if (isQuotationBeingIssued) {
                    payload.quotationIssuedAt = new Date().toISOString();
                    payload.quotationIssuedByUid = this.userProfile.uid;
                }
                if (isInvoiceBeingSent) {
                    payload.invoiceWorkflowStatus = 'Sending to Client';
                    payload.raw.invoiceWorkflowStatus = 'Sending to Client';
                } else if (payload.type === 'Invoice' && payload.status === 'Draft') {
                    payload.invoiceWorkflowStatus = 'Draft — Finance Review';
                    payload.raw.invoiceWorkflowStatus = 'Draft — Finance Review';
                }
                await setDoc(doc(db, "docs", docId), payload, { merge: true });
                this.editingDocId = docId;
                if (isQuotationBeingIssued) {
                    try { await this.runBillingWorkflow('quotation-issued', docId); }
                    catch (workflowError) { console.error('Quotation notification workflow failed:', workflowError); this.showNotify('Quotation was saved, but its Client ID notification could not be sent. Correct the Client/project link and try again.', 'error'); return false; }
                    this.notifyByEmail({
                        to: payload.raw.clientEmail,
                        subject: `Quotation Ready — ${payload.docNo}`,
                        heading: 'Your Quotation Is Ready',
                        message: `Quotation ${payload.docNo} for ${payload.name || 'your account'} is ready to review in the Client Portal. You can accept or decline it there.`,
                        ctaLabel: 'VIEW QUOTATION'
                    });
                }
                if (isInvoiceBeingSent) {
                    if (payload.raw.sourceQuotationId) await updateDoc(doc(db, 'docs', payload.raw.sourceQuotationId), { status: 'Invoiced', invoiceDocId: docId, invoiceCreatedAt: new Date().toISOString() });
                    try { await this.runBillingWorkflow('invoice-sent', docId); }
                    catch (workflowError) { console.error('Invoice notification workflow failed:', workflowError); this.showNotify('Invoice was saved, but its notification will be retried from the billing queue.', 'error'); return false; }
                    this.notifyByEmail({
                        to: payload.raw.clientEmail,
                        subject: `Invoice Ready — ${payload.docNo}`,
                        heading: 'Your Invoice Is Ready',
                        message: `Invoice ${payload.docNo} for ${payload.name || 'your account'} is ready in the Client Portal. Please review it and upload payment proof once payment is made.`,
                        ctaLabel: 'VIEW INVOICE'
                    });
                    this.showNotify(`Invoice sent to Client and recorded in the billing workflow.`);
                } else {
                    this.showNotify(isQuotationBeingIssued ? 'Quotation sent to Client.' : payload.status === 'Draft' ? 'Invoice draft saved. It is not visible to the Client.' : 'Document saved.');
                }
                return true;
            } catch (error) { console.error('Document save failed:', error); this.showNotify('Unable to save document. Check the attachment size and try again.'); return false; }
        },
        async savePayslipRecord() {
            try {
                if (!this.canManagePayroll) { this.showNotify('You do not have permission to save payslips.'); return; }
                const normalizedPayForm = this.normalizeOfficialRecord(this.payForm);
                normalizedPayForm.empEmail = String(this.payForm.empEmail || '').trim().toLowerCase();
                Object.assign(this.payForm, normalizedPayForm);
                const docId = String(this.editingPayId || Date.now());
                const payload = { id: docId, type: 'Payslip', docNo: `PS-${this.currentYear}-${this.payForm.empNo}`, date: this.payForm.payDate, name: this.payForm.name, amount: this.payCalc.net, raw: JSON.parse(JSON.stringify(this.payForm)) };
                await setDoc(doc(db, "payslips", docId), payload, { merge: true }); this.editingPayId = null; this.showNotify(`Payslip saved.`);
            } catch (error) { console.error('Payslip save failed:', error); this.showNotify('Unable to save payslip.'); }
        },
        addDocItem() { this.docForm.items.push({ desc: '', qty: 1, price: 0 }); },
        removeDocItem(idx) { this.docForm.items.splice(idx, 1); },
        generateDocNo(includeCurrentNumber = false) {
            if (this.editingDocId) return;
            const prefix = this.docForm.type === 'Invoice' ? 'INV' : 'QT';
            const relevantDocs = this.docHistory.filter(d => d.type === this.docForm.type && String(d.docNo || '').includes(`-${this.currentYear}-`));
            let maxNum = 1000;
            relevantDocs.forEach(d => { if (d.docNo) { const num = parseInt(d.docNo.split('-').pop(), 10); if (!isNaN(num) && num > maxNum) maxNum = num; } });
            // The realtime document list can arrive a moment after a save. When a
            // user immediately changes client, also consider the number already in
            // the form so the next document cannot reuse it during that short gap.
            if (includeCurrentNumber) {
                const currentNum = parseInt(String(this.docForm.docNo || '').split('-').pop(), 10);
                if (!isNaN(currentNum) && currentNum > maxNum) maxNum = currentNum;
            }
            this.docForm.docNo = `${prefix}-${this.currentYear}-${String(maxNum + 1).padStart(5, '0')}`;
        },

        autoCalculatePayroll() {
            const rates = this.payForm.isSenior ? STATUTORY_RATES.senior : STATUTORY_RATES.regular;
            let epfWages = (Number(this.payForm.basic)||0) + (Number(this.payForm.phone)||0) + (Number(this.payForm.transport)||0) + (Number(this.payForm.meal)||0) + (Number(this.payForm.bonus)||0);
            let socsoWages = epfWages + (Number(this.payForm.ot)||0);
            let gross = socsoWages;
            let epfEmp = Math.round(epfWages * rates.epf.employeePct);
            let epfEmpr = Math.round(epfWages * (epfWages <= rates.epf.threshold ? rates.epf.employerPctBelow5k : rates.epf.employerPctAbove5k));
            let capSocso = Math.min(socsoWages, rates.socso.wageCap);
            let socsoEmp = Math.round(capSocso * rates.socso.employeePct * 100) / 100;
            let socsoEmpr = Math.round(capSocso * rates.socso.employerPct * 100) / 100;
            let capEis = Math.min(socsoWages, rates.eis.wageCap);
            let eisEmp = Math.round(capEis * rates.eis.employeePct * 100) / 100;
            let eisEmpr = Math.round(capEis * rates.eis.employerPct * 100) / 100;
            this.payForm.dedEpf = epfEmp; this.payForm.dedSocso = socsoEmp; this.payForm.dedEis = eisEmp;
            let deduct = epfEmp + socsoEmp + eisEmp + (Number(this.payForm.dedPcb)||0) + (Number(this.payForm.dedAdvance)||0) + (Number(this.payForm.dedOther)||0);
            let net = gross - deduct;
            this.payCalc = { gross, deduct, net, epfEmpr, socsoEmpr, eisEmpr };
        },
        async viewRecord(item) {
            const previewItem = JSON.parse(JSON.stringify(item));
            if (!previewItem.isDoc && !previewItem.isPay) previewItem.isPay = previewItem.type === 'Payslip';
            if (!previewItem.isDoc && !previewItem.isPay) previewItem.isDoc = true;
            if (!previewItem.raw) { this.showNotify('Record preview is unavailable.'); return; }
            const originalDoc = JSON.parse(JSON.stringify(this.docForm));
            const originalPay = JSON.parse(JSON.stringify(this.payForm));
            const originalModule = this.activePrintModule;
            if (previewItem.isDoc) {
                this.docForm = JSON.parse(JSON.stringify(previewItem.raw));
                this.activePrintModule = previewItem.type === 'Quotation' ? 'QUOTATION' : 'INVOICE';
            } else {
                this.payForm = JSON.parse(JSON.stringify(previewItem.raw));
                this.autoCalculatePayroll();
                this.activePrintModule = 'PAYSLIP';
            }
            await this.$nextTick();
            const templateId = previewItem.isDoc ? (previewItem.type === 'Quotation' ? 'print-template-quotation' : 'print-template-invoice') : 'print-template-payslip';
            const template = document.getElementById(templateId);
            const html = template ? template.outerHTML.replace(/\bprint-only\b/g, '') : '';
            this.docForm = originalDoc;
            this.payForm = originalPay;
            this.activePrintModule = originalModule;
            this.autoCalculatePayroll();
            this.recordPreview = { show: true, html };
        },
        // Both bulk actions work on exactly what the filter chips are showing,
        // so "download what I am looking at" needs no second set of controls.
        async printAllClientDocuments() {
            const items = this.filteredClientPortalDocs;
            if (!items.length) { this.showNotify('There are no documents to print.', 'error'); return; }
            if (!await this.askConfirm({
                title: `Print ${items.length} document${items.length === 1 ? '' : 's'}?`,
                message: 'Every document below is laid out on its own page, so one print produces a single PDF containing all of them.',
                confirmLabel: 'Yes, Prepare Print'
            })) return;
            this.bulkPrintPreparing = true;
            const originalDoc = JSON.parse(JSON.stringify(this.docForm));
            const originalModule = this.activePrintModule;
            try {
                const pages = [];
                for (const item of items) {
                    if (!item.raw) continue;
                    this.docForm = JSON.parse(JSON.stringify(item.raw));
                    this.activePrintModule = item.type === 'Quotation' ? 'QUOTATION' : 'INVOICE';
                    await this.$nextTick();
                    const templateId = item.type === 'Quotation' ? 'print-template-quotation' : 'print-template-invoice';
                    const template = document.getElementById(templateId);
                    if (!template) continue;
                    pages.push(template.outerHTML.replace(/print-only/g, ''));
                }
                if (!pages.length) { this.showNotify('None of these documents could be rendered.', 'error'); return; }
                // A break after each but the last, or the final page prints blank.
                this.recordPreview = {
                    show: true,
                    html: pages.map((page, i) => i < pages.length - 1
                        ? `<div style="page-break-after: always; break-after: page;">${page}</div>`
                        : page).join('')
                };
            } finally {
                this.docForm = originalDoc;
                this.activePrintModule = originalModule;
                this.bulkPrintPreparing = false;
            }
        },
        exportClientStatement() {
            if (!this.clientTierAllows('account-statement')) {
                this.showNotify(this.clientTierLockMessage('account-statement'), 'error');
                return;
            }
            const items = this.filteredClientPortalDocs;
            if (!items.length) { this.showNotify('There are no documents to export.', 'error'); return; }
            const rows = [
                ['ZENQOR HRMS/CDTS - CLIENT DOCUMENT STATEMENT'],
                ['Client', this.clientPortalIdentity.clientName || ''],
                ['Generated', this.formatDateTime(new Date().toISOString())],
                ['Documents', items.length],
                [],
                ['Type', 'Document No.', 'Date', 'Amount (RM)', 'Status', 'Decision / Proof']
            ];
            for (const d of items) {
                const stamp = d.clientDecisionAt
                    ? `${d.status} by ${d.clientDecisionByName || ''} on ${this.formatDateTime(d.clientDecisionAt)}`
                    : d.paymentProofAt
                        ? `Payment proof submitted ${this.formatDateTime(d.paymentProofAt)}`
                        : '';
                rows.push([d.type, d.docNo, d.date, Number(d.amount || 0).toFixed(2), d.status || '', stamp]);
            }
            const total = items.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
            rows.push([], ['Total', '', '', total.toFixed(2), '', '']);
            this.downloadCSV(rows, `zenqor_statement_${this.getLocalDateKey()}.csv`);
            this.showNotify('Statement downloaded.');
        },
        viewClaimRecord(claim) {
            this.claimPreview = { show: true, claim: JSON.parse(JSON.stringify(claim)), directorApprovalAttachment: '', directorApprovalAttachmentName: '', directorApprovalOriginalBytes: 0 };
        },
        editRecord(item) {
            this.mobileMenuOpen = false;
            if (item.isDoc) { this.editingDocId = item.id; if (item.raw) { this.docForm = JSON.parse(JSON.stringify(item.raw)); this.docForm.status = item.status || item.raw.status || (item.type === 'Invoice' ? 'Unpaid' : 'Open'); this.clientSavedForDocument = Boolean(this.docForm.customerId); } this.switchTab('document-quotations'); }
            else if (item.isPay) { this.editingPayId = item.id; if (item.raw) { this.payForm = JSON.parse(JSON.stringify(item.raw)); this.selectedPayEmployeeId = this.payForm.empNo || ''; } this.autoCalculatePayroll(); this.switchTab('payslip-generator'); }
            else if (item.isVoucher) this.editPaymentVoucher(item);
            else if (item.isClaim) this.editClaimRecord(item);
        },
        canDeleteBillingDocument(item) {
            return this.canDeleteBillingDocuments && ['Invoice', 'Quotation'].includes(item?.type);
        },
        async confirmDeleteRecord(item) {
            const canDeleteThisRecord = item?.isDoc ? this.canDeleteBillingDocument(item) : this.canDelete;
            if (!canDeleteThisRecord) { this.showNotify(item?.isDoc ? 'Only Director, Finance or Superadmin can delete invoices and quotations.' : 'Only Superadmin and Director can delete records.'); return; }
            if (!await this.askConfirm({
                title: 'Delete record?',
                message: `${item.docNo || item.fileName || 'This record'} will be permanently deleted. This action cannot be undone.`,
                confirmLabel: 'Yes, Delete Record',
                danger: true
            })) return;
            try { if (item.isDoc) await deleteDoc(doc(db, "docs", item.id)); else if (item.isPay) await deleteDoc(doc(db, "payslips", item.id)); else if (item.isVoucher) await deleteDoc(doc(db, "payment_vouchers", item.id)); else if (item.isClaim) await deleteDoc(doc(db, "claims", item.id)); this.showNotify('Record deleted.'); } catch (error) { console.error('Record deletion failed:', error); this.showNotify('Unable to delete record.'); }
        }
};