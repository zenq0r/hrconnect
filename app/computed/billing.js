// Quotation/invoice arithmetic (subtotal, SST, grand total) and the billing
// workflow queue that moves an accepted quotation through to a paid invoice.
import { CLIENT_TIER_ORDER, canonicalClientTier } from "../constants/client-tiers.js";
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
        // Premium/Priority ranks above Standard, Priority above Premium — the
        // "priority-queue" tier feature. A missing/unresolvable customer sorts
        // as Standard (rank 0), never higher.
        billingItemTierRank() {
            return (item) => {
                const customer = this.customers.find(c => c.id === String(item.raw?.customerId || item.billingClientId || ''));
                return CLIENT_TIER_ORDER.indexOf(canonicalClientTier(customer?.clientTier));
            };
        },
        // Template-facing label for the badge on each billing queue card —
        // blank for Standard so the common case stays uncluttered.
        billingItemTierLabel() {
            return (item) => {
                const rank = this.billingItemTierRank(item);
                return rank > 0 ? CLIENT_TIER_ORDER[rank] : '';
            };
        },
        billingWorkflowQueue() {
            if (!this.canViewBillingWorkflow) return [];
            const isCentralReviewer = this.isFullAccessRole || ['HR', 'Account'].includes(this.userProfile.role);
            const tierRank = this.billingItemTierRank;
            const byTierThenDate = (dateKey) => (a, b) => (tierRank(b) - tierRank(a)) || String(dateKey(b) || '').localeCompare(String(dateKey(a) || ''));
            // Paid is the workflow's final state. status !== 'Paid' (rather than
            // paymentProofReviewStatus !== 'Verified') is the guard, because a
            // manually-marked-Paid invoice — status set straight from the Invoice
            // form, bypassing reviewPaymentProof() entirely, e.g. a cash payment —
            // must stop demanding action here too, whatever its review status
            // happens to still read. Nothing about the proof itself is touched:
            // it stays on the invoice for Invoice History / Audit History either
            // way, this only removes it from the outstanding-action queue.
            const submittedProofs = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status !== 'Draft' && item.status !== 'Paid' && item.paymentProofUrl)
                .filter(item => isCentralReviewer || this.billingPicProjectIds.has(String(item.raw?.projectId || '')))
                .map(item => ({ ...item, workflowAction: 'review-proof', workflowLabel: item.paymentProofReviewStatus === 'Rejected' ? 'Review replacement proof' : 'Verify payment proof' }));
            if (!this.canManageBillingWorkflow) return submittedProofs
                .sort(byTierThenDate(item => item.paymentProofAt || item.date));
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
                .sort(byTierThenDate(item => item.billingWorkflowUpdatedAt || item.paymentProofAt || item.clientDecisionAt || item.date));
        }
};