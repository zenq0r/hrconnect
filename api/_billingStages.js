// CommonJS twin of app/constants/billing-workflow.js, for the serverless
// billing handler. The portal cannot import from here and this cannot import
// from there (ESM vs CJS, two runtimes), so the stage keys and labels are
// written out once in each place and checked against each other by
// tests/client-billing-workflow.test.js.

const BILLING_STAGE_KEYS = [
    'quotation_created',
    'quotation_sent',
    'quotation_accepted',
    'invoice_created',
    'invoice_sent',
    'payment_proof_submitted',
    'payment_under_review',
    'payment_verified',
    'paid'
];

const BILLING_BRANCH_KEYS = [
    'quotation_declined',
    'payment_proof_rejected',
    'invoice_cancelled'
];

const BILLING_STAGE_LABELS = {
    quotation_created: 'Quotation Created',
    quotation_sent: 'Quotation Sent to Client',
    quotation_accepted: 'Quotation Accepted',
    invoice_created: 'Invoice Created',
    invoice_sent: 'Invoice Sent — Unpaid',
    payment_proof_submitted: 'Payment Proof Submitted',
    payment_under_review: 'Payment Under Review',
    payment_verified: 'Payment Verified',
    paid: 'Paid',
    quotation_declined: 'Quotation Declined',
    payment_proof_rejected: 'Payment Proof Rejected',
    invoice_cancelled: 'Invoice Cancelled'
};

function billingStageLabel(key) {
    return BILLING_STAGE_LABELS[key] || 'Recorded';
}

function isBillingStage(key) {
    return BILLING_STAGE_KEYS.includes(key) || BILLING_BRANCH_KEYS.includes(key);
}

module.exports = {
    BILLING_STAGE_KEYS,
    BILLING_BRANCH_KEYS,
    BILLING_STAGE_LABELS,
    billingStageLabel,
    isBillingStage
};
