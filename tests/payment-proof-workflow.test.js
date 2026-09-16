const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, readRaw, methodSource } = require('./helpers/sources');

// Payment Reference No. and the receipt attachment used to be entered by
// STAFF on the Invoice form, at the moment the invoice was first created —
// before the client had even paid, so neither could possibly be correct.
// Both now belong to the client's own Payment Proof submission, made after
// they have actually transferred money. Bank Selection and Payment Receiver
// stay on the Invoice: they are the company's own payment instructions,
// printed on the document for the client to pay to, and staff legitimately
// know them in advance.

test('the staff Invoice form keeps payment instructions but drops the fields only a client can fill in', () => {
    const docs = readRaw('views/tab-documents.html');
    assert.match(docs, /BANK SELECTION/);
    assert.match(docs, /PAYMENT RECEIVER/);
    assert.doesNotMatch(docs, /PAYMENT REFERENCE NO\./, 'staff can never know the client\'s transfer reference before they have paid');
    assert.doesNotMatch(docs, /ATTACHMENT \/ RECEIPT/, 'staff can never have the client\'s receipt before they have paid');
    assert.doesNotMatch(docs, /handleAttachmentUpload/);
});

test('saveDocRecord never writes paymentRefNo or paymentAttachment, so a re-save cannot clobber what the client already submitted', () => {
    const fn = methodSource('saveDocRecord');
    assert.doesNotMatch(fn, /paymentRefNo:/);
    assert.doesNotMatch(fn, /paymentAttachment:/);
    // The two fields staff genuinely do control are unaffected.
    assert.match(fn, /paymentBank: this\.docForm\.paymentBank/);
    assert.match(fn, /paymentReceiver: this\.docForm\.paymentReceiver/);
});

test('a printed invoice never shows a Payment Ref. No. staff could not have known in advance', () => {
    const printed = readRaw('views/print-templates.html');
    assert.doesNotMatch(printed, /Payment Ref\. No\./);
    // Bank/receiver instructions — genuinely staff-known in advance — still print.
    assert.match(printed, /Receiver Account/);
});

test('submitting payment proof requires both the reference and the receipt together', () => {
    const fn = methodSource('submitPaymentProof');
    const refCheck = fn.indexOf('if (!refNo)');
    const fileCheck = fn.indexOf('if (!file)');
    assert.ok(refCheck > -1 && fileCheck > -1, 'both the reference and the file must be validated before any upload starts');
    assert.match(fn, /paymentRefNo: refNo/, 'the client\'s claimed reference must travel with the proof onto the invoice');
    assert.match(fn, /purpose: 'Payment Proof'/, 'the proof stays filed in the client document repository as before');
});

test('opening or closing the payment proof modal never bypasses canAttachPaymentProof', () => {
    const open = methodSource('openPaymentProofModal');
    assert.match(open, /canAttachPaymentProof\(d\)/);
});

test('the payment proof modal collects the reference and the file in one required form', () => {
    const markup = readRaw('views/shared-modals.html');
    const start = markup.indexOf('paymentProofModal.show');
    assert.ok(start > -1, 'the payment proof modal must exist');
    const modal = markup.slice(start, markup.indexOf('</form>', start));
    assert.match(modal, /v-model="paymentProofModal\.refNo"/);
    assert.match(modal, /required/);
    assert.match(modal, /@change="selectPaymentProofFile"/);
    assert.match(modal, /@submit\.prevent="submitPaymentProof"/);
});

test('viewing or downloading a submitted payment proof uses the same CORS-safe path as the document library, not the image-only attachment preview', () => {
    // openAttachment() only supports PNG/JPEG and cannot force a real download —
    // a payment proof can be a PDF, and deserves the same view/download
    // reliability as every other client document (see downloadClientDocument()'s
    // CORS fallback).
    const clientPortal = readRaw('views/tab-client-portal.html');
    assert.doesNotMatch(clientPortal, /openAttachment\(d\.paymentProofUrl/);
    assert.match(clientPortal, /viewClientDocument\(\{ downloadURL: d\.paymentProofUrl \}\)/);
    assert.match(clientPortal, /downloadClientDocument\(\{ downloadURL: d\.paymentProofUrl, fileName: d\.paymentProofName \}\)/);

    const dashboard = readRaw('views/tab-dashboard.html');
    assert.doesNotMatch(dashboard, /openAttachment\(item\.paymentProofUrl/);
    assert.match(dashboard, /viewClientDocument\(\{ downloadURL: item\.paymentProofUrl \}\)/);
    assert.match(dashboard, /downloadClientDocument\(\{ downloadURL: item\.paymentProofUrl, fileName: item\.paymentProofName \}\)/);
});

test('the client can only replace a proof through the modal, not an immediate bare file input', () => {
    const clientPortal = readRaw('views/tab-client-portal.html');
    assert.doesNotMatch(clientPortal, /handlePaymentProofUpload/);
    assert.match(clientPortal, /@click="openPaymentProofModal\(d\)"/);
});

// ---------------------------------------------------------------------------
// A typical manual-transfer proof: which bank, whose account (Personal or
// Business), when, how much, the reference, and the receipt — not just a
// reference number and a bare file, so Finance has something to actually
// check a receipt against instead of taking the amount on faith.

test('the Malaysian bank list is comprehensive and never dead-ends an unlisted bank', () => {
    const { constantSource } = require('./helpers/sources');
    const banks = new Function(`${constantSource('MALAYSIA_BANKS')} return MALAYSIA_BANKS;`)();
    assert.ok(banks.length > 20, 'the list should cover the real range of banks operating in Malaysia');
    for (const name of ['Malayan Banking Berhad (Maybank)', 'CIMB Bank Berhad', 'Public Bank Berhad', 'RHB Bank Berhad', 'Bank Islam Malaysia Berhad']) {
        assert.ok(banks.includes(name), `${name} must be listed`);
    }
    assert.equal(banks[banks.length - 1], 'Other Bank', 'a bank not named in the list must not be a dead end');
    assert.equal(new Set(banks).size, banks.length, 'no duplicate bank names');
});

test('submitPaymentProof validates the full manual-transfer proof in order, before any upload begins', async () => {
    const obj = new Function(`return { ${methodSource('submitPaymentProof')} }`)();
    obj.canAttachPaymentProof = () => true;
    obj.userProfile = { clientDirectoryId: 'CUST-1' };
    const base = (overrides = {}) => ({ show: true, doc: { id: 'I1', docNo: 'INV-1' }, bankName: '', accountType: '', accountHolderName: '', paymentDate: '', amount: '', refNo: '', file: null, fileName: '', uploading: false, error: '', ...overrides });

    obj.paymentProofModal = base();
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /bank/i);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /Personal or a Business/);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad', accountType: 'Business' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /company name/i);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad', accountType: 'Business', accountHolderName: 'ACME SDN BHD' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /date/i);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad', accountType: 'Business', accountHolderName: 'ACME SDN BHD', paymentDate: '2026-09-14' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /amount/i);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad', accountType: 'Business', accountHolderName: 'ACME SDN BHD', paymentDate: '2026-09-14', amount: '1080' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /reference number/i);

    obj.paymentProofModal = base({ bankName: 'Public Bank Berhad', accountType: 'Business', accountHolderName: 'ACME SDN BHD', paymentDate: '2026-09-14', amount: '1080', refNo: 'REF123' });
    await obj.submitPaymentProof();
    assert.match(obj.paymentProofModal.error, /receipt|screenshot/i);
});

test('submitPaymentProof writes the full manual-transfer proof onto both the invoice and the client document repository', () => {
    const fn = methodSource('submitPaymentProof');
    for (const field of ['clientPaymentBank: bankName', 'clientPaymentAccountType: accountType', 'clientPaymentAccountHolder: accountHolderName', 'clientPaymentDate: paymentDate', 'clientPaymentAmount: amount']) {
        const occurrences = fn.split(field).length - 1;
        assert.equal(occurrences, 2, `${field} must be written to both the client_documents record and the invoice`);
    }
});

test('the payment proof form collects bank, account type, account holder, date and amount before the reference and receipt', () => {
    const markup = readRaw('views/shared-modals.html');
    const start = markup.indexOf('paymentProofModal.show');
    const modal = markup.slice(start, markup.indexOf('</form>', start));
    assert.match(modal, /v-model="paymentProofModal\.bankName"/);
    assert.match(modal, /v-for="bank in malaysiaBanks"/);
    assert.match(modal, /v-for="opt in clientPaymentAccountTypes"/);
    assert.match(modal, /paymentProofModal\.accountType = opt\.value/);
    assert.match(modal, /v-model="paymentProofModal\.accountHolderName"/);
    assert.match(modal, /v-model="paymentProofModal\.paymentDate"/);
    assert.match(modal, /v-model="paymentProofModal\.amount"/);
    // Bank comes before the reference/receipt fields in source order, matching
    // the requested flow: bank -> account type -> details -> proof.
    assert.ok(modal.indexOf('paymentProofModal.bankName') < modal.indexOf('paymentProofModal.refNo'));
    assert.ok(modal.indexOf('paymentProofModal.refNo') < modal.indexOf('selectPaymentProofFile'));
});

test('a submitted payment proof reads Pending Verification, not the old wording', () => {
    const fn = methodSource('clientBillingStatus');
    assert.match(fn, /'Pending Verification'/);
    assert.doesNotMatch(fn, /'Payment Under Review'/);
    // The status pill's own styling lookup must be kept in step with the rename.
    const markup = readRaw('views/tab-client-portal.html');
    assert.doesNotMatch(markup, /'Payment Under Review'/);
    assert.match(markup, /'Pending Verification'/);
});

test('Finance gets three distinct outcomes for a payment proof, all resolving to the one binary server decision', () => {
    // api/billing-workflow.js's payment-proof-reviewed only ever records
    // decision === 'approved' or not — a reject and a request-new-proof leave
    // the invoice in the exact same Unpaid/awaiting-resubmission state, so
    // the distinction only needs to live in which dialog copy Finance sees.
    const fn = methodSource('reviewPaymentProof');
    assert.match(fn, /decision === 'approved'/);
    assert.match(fn, /decision === 'new-proof'/);
    assert.match(fn, /'Request a new payment proof\?'/);
    assert.match(fn, /'Reject this payment\?'/);
    assert.match(fn, /decision: approved \? 'approved' : 'rejected'/);

    const dashboard = readRaw('views/tab-dashboard.html');
    assert.match(dashboard, /reviewPaymentProof\(item, 'approved'\)/);
    assert.match(dashboard, /reviewPaymentProof\(item, 'new-proof'\)/);
    assert.match(dashboard, /reviewPaymentProof\(item, 'rejected'\)/);
});

test('Finance sees what the client claimed about their payment right on the review card', () => {
    const dashboard = readRaw('views/tab-dashboard.html');
    assert.match(dashboard, /item\.clientPaymentBank/);
    assert.match(dashboard, /item\.clientPaymentAccountType/);
    assert.match(dashboard, /item\.clientPaymentAccountHolder/);
    assert.match(dashboard, /item\.clientPaymentDate/);
    assert.match(dashboard, /item\.clientPaymentAmount/);
});

test('Paid is a final state: a verified invoice drops out of Action Required, not just its Approve/Reject buttons', () => {
    // Approve used to only hide the two review buttons — the card itself, and
    // its slot in the "N Billing Items" count, stayed forever, because the
    // queue's own filter never excluded a Paid invoice once it had a proof
    // attached. status !== 'Paid' (not paymentProofReviewStatus !== 'Verified')
    // is the guard, so an invoice marked Paid by hand straight from the
    // Invoice form — bypassing reviewPaymentProof() entirely — also stops
    // demanding action, whatever its review status happens to still read.
    const fn = methodSource('billingWorkflowQueue');
    const submittedProofsAt = fn.indexOf('submittedProofs');
    assert.ok(submittedProofsAt > -1, 'billingWorkflowQueue must build its submittedProofs list');
    const filterLine = fn.slice(submittedProofsAt, fn.indexOf('\n', submittedProofsAt) + 200);
    assert.match(filterLine, /item\.status !== 'Paid'/);
    // The now-unreachable "Payment verified" queue-card label is gone — a
    // Verified/Paid item never reaches the map() that would have shown it.
    assert.doesNotMatch(fn, /'Payment verified'/);
});
