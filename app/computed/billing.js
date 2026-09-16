// Quotation/invoice arithmetic (subtotal, SST, grand total) and the billing
// workflow queue that moves an accepted quotation through to a paid invoice.
import {
    BILLING_STAGES,
    BILLING_BRANCH_STAGES,
    billingStageIndex,
    billingStageOfDocument,
    isBillingBranchStage
} from "../constants/billing-workflow.js";

// A project is "open" for billing purposes until it is finished. Nothing is
// excluded by reference prefix: staff name their own references, and a rule
// that reads them would quietly drop a project the day someone typed a
// different prefix.
const CLOSED_PROJECT_STAGES = ['Completed & Done'];

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
        // What the Assign dropdown actually renders: one <optgroup> per project
        // stage, in workflow order, so a long client history reads as work in
        // progress rather than as one flat list of everything ever opened.
        //
        // The project currently on the document is always present, even when it
        // is closed and the toggle is off — an existing record must never look
        // as though its assignment had been cleared.
        documentProjectGroupsForSelectedClient() {
            const selectedId = String(this.docForm.projectId || '');
            const visible = this.documentProjectsForSelectedClient.filter(project =>
                this.documentProjectShowClosed ||
                !CLOSED_PROJECT_STAGES.includes(project.status) ||
                String(project.id || '') === selectedId);
            return this.projectStages
                .map(stage => ({ stage, projects: visible.filter(project => (project.status || 'Project Planning') === stage) }))
                .filter(group => group.projects.length);
        },
        documentClosedProjectCount() {
            return this.documentProjectsForSelectedClient.filter(project => CLOSED_PROJECT_STAGES.includes(project.status)).length;
        },
        // The assignment, resolved once, so the summary card and every guard
        // read the same record instead of each searching for it again.
        selectedDocumentProject() {
            const projectId = String(this.docForm.projectId || '');
            if (!projectId) return null;
            return this.documentProjectsForSelectedClient.find(project => String(project.id || '') === projectId) || null;
        },
        // Where the record on screen currently sits. An unsaved form has no
        // stage yet — "Created" is earned by being saved, not by being typed.
        openDocumentStage() {
            if (!this.editingDocId) return '';
            const saved = this.docHistory.find(item => String(item.id) === String(this.editingDocId));
            return billingStageOfDocument(saved) || '';
        },
        // The ladder for the strip above the form: every stage, each marked
        // done / current / pending, plus any branch the document actually took.
        // A quotation shows the quotation half and an invoice the whole run,
        // because an invoice's own history begins at the quotation it came from.
        openDocumentLadder() {
            const stage = this.openDocumentStage;
            const reached = billingStageIndex(stage);
            const isQuotation = this.docForm.type === 'Quotation';
            const steps = BILLING_STAGES
                .filter(step => !isQuotation || step.appliesTo === 'Quotation')
                .map(step => {
                    const index = billingStageIndex(step.key);
                    return {
                        ...step,
                        state: reached < 0 ? 'pending' : index < reached ? 'done' : index === reached ? 'current' : 'pending'
                    };
                });
            if (!isBillingBranchStage(stage)) return steps;
            const branch = BILLING_BRANCH_STAGES.find(item => item.key === stage);
            return [...steps.map(step => ({ ...step, state: step.state === 'current' ? 'done' : step.state })), { ...branch, state: 'current' }];
        },
        // Sorted newest-last, the way a history is read. The server stamps
        // `seq` so two entries written in the same second still order.
        billingTimelineEntries() {
            return [...(this.billingTimelineModal.entries || [])]
                .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0) || String(a.at || '').localeCompare(String(b.at || '')));
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
                // A cancelled invoice is closed: its proof stays in the history
                // but there is nothing left for Finance to verify.
                .filter(item => item.type === 'Invoice' && !['Draft', 'Cancelled'].includes(item.status) && item.paymentProofUrl)
                .filter(item => isCentralReviewer || this.billingPicProjectIds.has(String(item.raw?.projectId || '')))
                .map(item => ({ ...item, workflowAction: 'review-proof', workflowLabel: item.paymentProofReviewStatus === 'Verified' ? 'Payment verified' : item.paymentProofReviewStatus === 'Rejected' ? 'Review replacement proof' : 'Verify payment proof' }));
            if (!this.canManageBillingWorkflow) return submittedProofs
                .sort((a, b) => String(b.paymentProofAt || b.date || '').localeCompare(String(a.paymentProofAt || a.date || '')));
            const linkedInvoiceQuoteIds = new Set(this.docHistory
                .filter(item => item.type === 'Invoice' && item.raw?.sourceQuotationId)
                .map(item => item.raw.sourceQuotationId));
            const acceptedQuotes = this.docHistory
                .filter(item => item.type === 'Quotation' && item.status === 'Accepted' && !linkedInvoiceQuoteIds.has(item.id))
                // Ordered oldest first within the group: the quotation a client
                // accepted two weeks ago is the one still waiting on an invoice.
                .sort((a, b) => String(a.clientDecisionAt || a.date || '').localeCompare(String(b.clientDecisionAt || b.date || '')))
                .map(item => ({ ...item, workflowAction: 'issue-invoice', workflowLabel: 'Prepare invoice' }));
            const invoiceDrafts = this.docHistory
                .filter(item => item.type === 'Invoice' && item.status === 'Draft')
                .map(item => ({ ...item, workflowAction: 'edit-draft', workflowLabel: 'Finance draft' }));
            return [...acceptedQuotes, ...invoiceDrafts, ...submittedProofs]
                .sort((a, b) => String(b.billingWorkflowUpdatedAt || b.paymentProofAt || b.clientDecisionAt || b.date || '').localeCompare(String(a.billingWorkflowUpdatedAt || a.paymentProofAt || a.clientDecisionAt || a.date || '')));
        }
};