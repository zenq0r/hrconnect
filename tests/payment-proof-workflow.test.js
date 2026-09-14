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
