const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, readRaw, methodSource } = require('./helpers/sources');

// Sending an invoice used to be a side effect of picking "Unpaid" in the
// Status dropdown and clicking the ordinary Save button — which even
// relabelled itself "Send Invoice to Client" the moment Status changed, so a
// routine save silently delivered the invoice and fired its email/portal
// notification. deliveryStatus ('Not Sent' -> 'Ready to Send' -> 'Sent') is
// now the ONLY thing that governs client visibility and notification, kept
// entirely separate from Status (the payment state), and sendInvoiceToClient()
// is the one explicit action that ever moves it to 'Sent'.

test('creating an invoice draft from an accepted quotation starts it at Not Sent', () => {
    const fn = methodSource('createInvoiceFromQuotation');
    assert.match(fn, /status: 'Draft'/);
    assert.match(fn, /deliveryStatus: 'Not Sent'/);
});

test('saveDocRecord never sends anything by itself, whatever Status is picked', () => {
    const fn = methodSource('saveDocRecord');
    assert.doesNotMatch(fn, /runBillingWorkflow\('invoice-sent'/, 'sendInvoiceToClient() is the only place invoice-sent may run');
    assert.doesNotMatch(fn, /sourceQuotationId.*status: 'Invoiced'/s, 'the quotation only moves to Invoiced from inside the send transaction now');
    // Every branch of the deliveryStatus decision survives in source.
    assert.match(fn, /deliveryStatus = 'Not Sent'/);
    assert.match(fn, /previous\?\.deliveryStatus === 'Sent'/);
    assert.match(fn, /deliveryStatus = 'Ready to Send'/);
    assert.match(fn, /previous\.status === 'Draft'/);
});

test('a legacy invoice with no deliveryStatus field is treated as already Sent, never demoted', () => {
    // Every invoice from before this field existed has no deliveryStatus at
    // all. Editing one now (a correction) must never accidentally introduce
    // 'Ready to Send' and hide a bill the client could already see.
    const fn = methodSource('saveDocRecord');
    const elseIndex = fn.lastIndexOf('deliveryStatus = ');
    assert.ok(elseIndex > -1);
    const tail = fn.slice(fn.lastIndexOf('} else {', elseIndex));
    assert.match(tail, /deliveryStatus = 'Sent'/);
});

test('sendInvoiceToClient is the one explicit action, gated to the same roles the server already enforces', () => {
    const fn = methodSource('sendInvoiceToClient');
    assert.match(fn, /canManageBillingWorkflow/, 'must require Director/Superadmin client-side — the server already refuses anyone else');
    assert.match(fn, /invoice\.status !== 'Unpaid'/, 'must match api/billing-workflow.js\'s own "document.status !== \'Unpaid\'" requirement');
    assert.match(fn, /invoice\.deliveryStatus === 'Sent'/, 'must refuse a second send');
    assert.match(fn, /askConfirm\(/, 'sending is irreversible — must be confirmed');
    assert.match(fn, /runBillingWorkflow\('invoice-sent', invoice\.id\)/);
    assert.match(fn, /notifyByEmail\(/, 'the email is a client-triggered call, not part of the server transaction');

    const handler = readRaw('api/billing-workflow.js');
    assert.match(handler, /INVOICE_MANAGEMENT_ROLES\.has\(callerRole\)/);
    assert.match(handler, /document\.status !== 'Unpaid'/);
});

test('the server transaction, not the client, is what actually delivers the invoice', () => {
    // deliveryStatus, the quotation's status move to Invoiced, and the audit
    // event all land in the SAME transaction — atomic, and idempotent via the
    // eventRef existence check, matching every other billing-workflow action.
    const handler = readRaw('api/billing-workflow.js');
    const start = handler.indexOf("if (action === 'invoice-sent')");
    const body = handler.slice(start, handler.indexOf("if (action === 'payment-proof-reviewed')", start));
    assert.match(body, /runTransaction/);
    assert.match(body, /deliveryStatus: 'Sent'/);
    assert.match(body, /if \(sourceQuotationId\) \{/);
    assert.match(body, /status: 'Invoiced'/);
});

test('firestore.rules hides an unsent invoice from the client, but never a legacy one that had no deliveryStatus', () => {
    const rules = readRaw('firestore.rules');
    // clientCanReadInvoice() itself: Sent is readable; a record with no
    // deliveryStatus at all is readable UNLESS it is still literally a Draft —
    // a legacy Draft (predating this field) must stay exactly as hidden as it
    // always was, not newly leaked just because the field is missing.
    const fnStart = rules.indexOf('function clientCanReadInvoice(data)');
    assert.ok(fnStart > -1, 'clientCanReadInvoice() must exist as its own named function');
    const fnBody = rules.slice(fnStart, rules.indexOf('}', rules.indexOf('}', fnStart) + 1));
    assert.match(fnBody, /data\.deliveryStatus == 'Sent'/);
    assert.match(fnBody, /!\('deliveryStatus' in data\) && data\.status != 'Draft'/);

    const start = rules.indexOf('match /docs/{docId}');
    const readBlock = rules.slice(start, rules.indexOf('allow create:', start));
    const occurrences = readBlock.match(/clientCanReadInvoice\(resource\.data\)/g) || [];
    assert.equal(occurrences.length, 2, 'both client-ownership branches (primary contact and secondary/customerId) must carry the same gate');
    assert.doesNotMatch(readBlock, /resource\.data\.status != 'Draft'/, 'the old Status-only gate must be fully replaced, not left alongside the new one');
});

test('editRecord carries deliveryStatus into the form, the same way it already carries Status', () => {
    const fn = methodSource('editRecord');
    assert.match(fn, /this\.docForm\.deliveryStatus = item\.deliveryStatus \|\| item\.raw\.deliveryStatus \|\| ''/);
});

test('the document editor never relabels Save as a send action, and the real Send button only ever appears for a saved, Unpaid, unsent invoice', () => {
    const docs = readRaw('views/tab-documents.html');
    assert.doesNotMatch(docs, /docForm\.status === 'Unpaid' \? 'fa-paper-plane' : 'fa-floppy-disk'/, 'Save must always be Save, never relabel itself Send');
    assert.doesNotMatch(docs, /'Send Invoice to Client' : 'Save Document'/);

    const sendButtonStart = docs.indexOf('sendInvoiceToClient({ id: editingDocId');
    assert.ok(sendButtonStart > -1, 'a real Send button must exist, bound to sendInvoiceToClient');
    const sendButtonLine = docs.slice(docs.lastIndexOf('<button', sendButtonStart), sendButtonStart);
    assert.match(sendButtonLine, /editingDocId && docForm\.type === 'Invoice' && docForm\.status === 'Unpaid' && docForm\.deliveryStatus !== 'Sent'/);
});

test('the Billing Workflow queue surfaces a finalized-but-unsent invoice with its own Send button, separate from the Draft review card', () => {
    const fn = methodSource('billingWorkflowQueue');
    assert.match(fn, /workflowAction: 'send-invoice'/);
    assert.match(fn, /item\.status === 'Unpaid' && item\.deliveryStatus && item\.deliveryStatus !== 'Sent'/);

    const dashboard = readRaw('views/tab-dashboard.html');
    assert.match(dashboard, /item\.workflowAction === 'send-invoice'/);
    assert.match(dashboard, /@click="sendInvoiceToClient\(item\)"/);
});

test('a Ready to Send invoice never appears in the queue as a plain Draft, and vice versa', () => {
    const fn = methodSource('billingWorkflowQueue');
    const draftFilterLine = fn.slice(fn.indexOf('const invoiceDrafts'), fn.indexOf('.map(item => ({ ...item, workflowAction: \'edit-draft\'') + 80);
    assert.match(draftFilterLine, /item\.status === 'Draft'/);
    assert.doesNotMatch(draftFilterLine, /deliveryStatus/, 'the Draft card is keyed on Status alone — deliveryStatus is always \'Not Sent\' there anyway');
});
