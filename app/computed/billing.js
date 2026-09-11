// Quotation/invoice arithmetic (subtotal, SST, grand total) and the billing
// workflow queue that moves an accepted quotation through to a paid invoice.
export const billingComputed = {

        docSubtotal() { return this.docForm.items.reduce((s, i) => s + (i.qty * i.price), 0); },
        docSST() { return this.docSubtotal * 0.08; },
        docGrandTotal() { return this.docSubtotal - this.docForm.discount + this.docSST; },

        clientPortalDocs() {
            // A Client reads the retention-gated list; Staff previewing the portal
            // are not subject to a client's tier, so they keep the raw match.
            if (this.userProfile.role === 'Client') return this.myClientDocs;
            if (this.userProfile.role === 'Staff') {
                const clientDirectoryId = String(this.userProfile.clientDirectoryId || '').trim();
                const clientEmail = String(this.userProfile.email || '').trim().toLowerCase();
                return this.docHistory.filter(d => d.raw && (
                    (clientDirectoryId && String(d.raw.customerId || '').trim() === clientDirectoryId) ||
                    (clientEmail && String(d.raw.clientEmail || '').trim().toLowerCase() === clientEmail)
                ));
            }
            return this.docHistory;
        },
        filteredClientPortalDocs() {
            return this.clientPortalDocs.filter(d => {
                const typeOk = this.clientPortalFilter.type === 'all' || d.type === this.clientPortalFilter.type;
                const statusOk = this.clientPortalFilter.status === 'all' || (d.status || 'Unpaid') === this.clientPortalFilter.status;
                return typeOk && statusOk;
            });
        },
        documentProjectsForSelectedClient() {
            const customerId = String(this.docForm.customerId || '');
            if (!customerId) return [];
            return this.projects
                .filter(project => project.clientDirectoryId === customerId)
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        },
        // Client Billing Workflow is not a general staff module. A current PIC,
        // HR/Account, Director or Superadmin is admitted; everyone else receives
        // no billing queue at all.
        billingPicProjectIds() {
            const email = String(this.userProfile.email || '').trim().toLowerCase();
            return new Set(this.projects
                .filter(project => String(project.ownerEmail || '').trim().toLowerCase() === email)
                .map(project => String(project.id || ''))
                .filter(Boolean));
        },
        isBillingProjectPic() { return this.billingPicProjectIds.size > 0; },
        canViewBillingWorkflow() { return this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role) || this.isBillingProjectPic; },
        canManageBillingWorkflow() { return this.isFullAccessRole; },
        canVerifyPaymentProof() { return this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role) || this.isBillingProjectPic; },
        billingWorkflowQueue() {
            if (!this.canViewBillingWorkflow) return [];
            const isCentralReviewer = this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role);
            const submittedProofs = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status !== 'Draft' && item.paymentProofUrl)
                .filter(item => isCentralReviewer || this.billingPicProjectIds.has(String(item.raw?.projectId || '')))
                .map(item => ({ ...item, workflowAction: 'review-proof', workflowLabel: item.paymentProofReviewStatus === 'Verified' ? 'Payment verified' : item.paymentProofReviewStatus === 'Rejected' ? 'Review replacement proof' : 'Verify payment proof' }));
            if (!this.canManageBillingWorkflow) return submittedProofs
                .sort((a, b) => String(b.paymentProofAt || b.date || '').localeCompare(String(a.paymentProofAt || a.date || '')));
            const linkedInvoiceQuoteIds = new Set(this.docHistory
                .filter(item => item.type === 'Invoice' && item.raw?.sourceQuotationId)
                .map(item => item.raw.sourceQuotationId));
            const acceptedQuotes = this.docHistory
                .filter(item => item.type === 'Quotation' && item.status === 'Accepted' && !linkedInvoiceQuoteIds.has(item.id))
                .map(item => ({ ...item, workflowAction: 'issue-invoice', workflowLabel: 'Prepare invoice' }));
            const invoiceDrafts = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status === 'Draft')
                .map(item => ({ ...item, workflowAction: 'edit-draft', workflowLabel: 'Finance draft' }));
            return [...acceptedQuotes, ...invoiceDrafts, ...submittedProofs]
                .sort((a, b) => String(b.billingWorkflowUpdatedAt || b.paymentProofAt || b.clientDecisionAt || b.date || '').localeCompare(String(a.billingWorkflowUpdatedAt || a.paymentProofAt || a.clientDecisionAt || a.date || '')));
        }
};