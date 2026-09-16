// The billing ladder, and nothing else. Every stage a quotation or an invoice
// can reach is named here once, so the form strip, the timeline modal, the
// dashboard queue and the server handler all read the same list rather than
// each carrying its own copy of the words.
//
// api/_billingStages.js is the CommonJS twin of this file, for the serverless
// handler that writes the timeline. The two must be changed together;
// tests/client-billing-workflow.test.js checks that they still agree.

// The happy path, in order. `index` is what makes "has this document passed
// that point yet" a comparison rather than a pile of if-statements.
export const BILLING_STAGES = [
    { key: 'quotation_created', label: 'Quotation Created', short: 'Created', appliesTo: 'Quotation', icon: 'fa-file-pen' },
    { key: 'quotation_sent', label: 'Quotation Sent to Client', short: 'Sent', appliesTo: 'Quotation', icon: 'fa-paper-plane' },
    { key: 'quotation_accepted', label: 'Quotation Accepted', short: 'Accepted', appliesTo: 'Quotation', icon: 'fa-circle-check' },
    { key: 'invoice_created', label: 'Invoice Created', short: 'Invoiced', appliesTo: 'Invoice', icon: 'fa-file-invoice-dollar' },
    { key: 'invoice_sent', label: 'Invoice Sent — Unpaid', short: 'Unpaid', appliesTo: 'Invoice', icon: 'fa-envelope-open-text' },
    { key: 'payment_proof_submitted', label: 'Payment Proof Submitted', short: 'Proof In', appliesTo: 'Invoice', icon: 'fa-receipt' },
    { key: 'payment_under_review', label: 'Payment Under Review', short: 'Review', appliesTo: 'Invoice', icon: 'fa-magnifying-glass-dollar' },
    { key: 'payment_verified', label: 'Payment Verified', short: 'Verified', appliesTo: 'Invoice', icon: 'fa-shield-halved' },
    { key: 'paid', label: 'Paid', short: 'Paid', appliesTo: 'Invoice', icon: 'fa-sack-dollar' }
];

// Where a document can leave the ladder. These are recorded in the timeline
// exactly like the stages above — a declined quotation is history, not a gap.
export const BILLING_BRANCH_STAGES = [
    { key: 'quotation_declined', label: 'Quotation Declined', short: 'Declined', tone: 'danger', icon: 'fa-circle-xmark' },
    { key: 'payment_proof_rejected', label: 'Payment Proof Rejected', short: 'Proof Rejected', tone: 'danger', icon: 'fa-triangle-exclamation' },
    { key: 'invoice_cancelled', label: 'Invoice Cancelled', short: 'Cancelled', tone: 'danger', icon: 'fa-ban' }
];

export const BILLING_STAGE_KEYS = BILLING_STAGES.map(stage => stage.key);

const ALL_STAGES = [...BILLING_STAGES, ...BILLING_BRANCH_STAGES];

export const billingStageLabel = key => ALL_STAGES.find(stage => stage.key === key)?.label || 'Recorded';
export const billingStageIcon = key => ALL_STAGES.find(stage => stage.key === key)?.icon || 'fa-circle-dot';
export const billingStageIndex = key => BILLING_STAGE_KEYS.indexOf(key);
export const isBillingBranchStage = key => BILLING_BRANCH_STAGES.some(stage => stage.key === key);

// The stage a saved record is *currently* at, derived from the record itself
// rather than from a separate field that could drift out of step with it.
// Read from the bottom up: the furthest point the document has reached wins.
export function billingStageOfDocument(item) {
    if (!item) return '';
    if (item.type === 'Quotation') {
        if (item.status === 'Rejected') return 'quotation_declined';
        if (item.status === 'Invoiced') return 'invoice_created';
        if (item.status === 'Accepted') return 'quotation_accepted';
        if (item.quotationIssuedAt || item.status === 'Open') return 'quotation_sent';
        return 'quotation_created';
    }
    if (item.type !== 'Invoice') return '';
    if (item.status === 'Cancelled') return 'invoice_cancelled';
    if (item.status === 'Paid' || item.paymentProofReviewStatus === 'Verified') return 'paid';
    if (item.paymentProofReviewStatus === 'Rejected') return 'payment_proof_rejected';
    if (item.paymentProofReviewStatus === 'Submitted') return 'payment_under_review';
    if (item.paymentProofUrl) return 'payment_proof_submitted';
    if (item.status === 'Draft') return 'invoice_created';
    return 'invoice_sent';
}
