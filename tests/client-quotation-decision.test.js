const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readSource } = require('./helpers/sources');

const read = name => readSource(name);
const docsRule = () => {
    const rules = read('firestore.rules');
    const start = rules.indexOf('match /docs/{docId}');
    const end = rules.indexOf('match /client_documents/', start);
    assert.ok(start > -1 && end > start, 'the docs rule must remain identifiable');
    return rules.slice(start, end);
};

test('a client may only move an open quotation to a decision', () => {
    const rule = docsRule();
    assert.match(rule, /resource\.data\.type == 'Quotation'/);
    // Already-answered quotations and invoices are out of reach.
    assert.match(rule, /resource\.data\.status == 'Open'/);
    assert.match(rule, /request\.resource\.data\.status in \['Accepted', 'Rejected'\]/);
});

test('the decision cannot alter anything the quotation says', () => {
    const rule = docsRule();
    // Without this, a client could rewrite the amount while "accepting".
    const allowed = rule.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
    assert.ok(allowed, 'the client branch must constrain affectedKeys');
    const fields = allowed[1].match(/'[^']+'/g).map(f => f.replace(/'/g, ''));
    assert.deepEqual(fields.sort(), [
        'clientDecisionAt', 'clientDecisionByName', 'clientDecisionByUid', 'clientDecisionNote', 'status'
    ]);
    for (const field of ['amount', 'raw', 'docNo', 'type', 'date']) {
        assert.ok(!fields.includes(field), `${field} must stay as issued`);
    }
});

test('ownership is checked the same two ways the read rule allows', () => {
    const rule = docsRule();
    // Primary contact, or an authorized secondary email on the linked customer.
    assert.match(rule, /resource\.data\.raw\.clientEmail == request\.auth\.token\.email/);
    assert.match(rule, /customerEmailMatches\(get\(\/databases\/\$\(database\)\/documents\/customers\/\$\(resource\.data\.raw\.customerId\)\)\.data, request\.auth\.token\.email\)/);
    assert.match(rule, /isClient\(\) &&/);
});

test('staff keep their own write path, while Finance may delete billing documents only', () => {
    const rule = docsRule();
    // The same four roles as before, now also holding their document to totals
    // that add up — see tests/money-enforcement.test.js.
    assert.match(rule, /allow create: if \(isSuperadmin\(\) \|\| isDirector\(\) \|\| isHR\(\) \|\| isAccount\(\)\) &&/);
    assert.match(rule, /allow update: if \(\(isSuperadmin\(\) \|\| isDirector\(\) \|\| isHR\(\) \|\| isAccount\(\)\) && billingTotalsAccepted\(\)\) \|\|/);
    assert.match(rule, /allow delete: if isAdmin\(\) \|\| \(isAccount\(\) && resource\.data\.type in \['Invoice', 'Quotation'\]\);/);
});

test('the document delete gate admits only Director, Finance and Superadmin', () => {
    const app = read('app.js');
    const page = read('index.html');

    assert.match(app, /canDeleteBillingDocuments\(\) \{ return \['Superadmin', 'Director', 'Account'\]\.includes\(this\.userProfile\.role\); \}/);
    assert.match(app, /canDeleteBillingDocument\(item\) \{[\s\S]{0,160}?\['Invoice', 'Quotation'\]\.includes\(item\?\.type\)/);
    assert.match(page, /canDeleteBillingDocument\(item\)/);
});

test('the client gate mirrors the rule before showing the buttons', () => {
    const app = read('app.js');
    const start = app.indexOf('canDecideQuotation(d) {');
    const gate = app.slice(start, app.indexOf('},', start));
    assert.match(gate, /role !== 'Client'/);
    assert.match(gate, /d\.type !== 'Quotation'/);
    assert.match(gate, /!== 'Open'/);
    // Ownership: the document must be one of the client's own.
    assert.match(gate, /clientPortalDocs\.some/);

    const page = read('index.html');
    assert.match(page, /v-if="canDecideQuotation\(d\)"/);
    assert.match(page, /decideQuotation\(d, 'Accepted'\)/);
    assert.match(page, /decideQuotation\(d, 'Rejected'\)/);
});

test('an accepted quotation does not read as a failure', () => {
    // The badge only knew Paid from everything else, so Accepted painted red.
    assert.match(read('index.html'), /\['Paid', 'Accepted'\]\.includes\(d\.status\)/);
});

test('payment proof cannot settle an invoice', () => {
    const rule = docsRule();
    assert.match(rule, /resource\.data\.type == 'Invoice'/);
    assert.match(rule, /resource\.data\.status != 'Paid'/);
    // status is deliberately absent here: attaching proof records evidence,
    // it does not mark the invoice Paid. Only staff decide that.
    const branch = rule.slice(rule.indexOf("resource.data.type == 'Invoice'"));
    const allowed = branch.match(/affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
    assert.ok(allowed, 'the proof branch must constrain affectedKeys');
    const fields = allowed[1].match(/'[^']+'/g).map(f => f.replace(/'/g, ''));
    assert.deepEqual(fields.sort(), [
        'paymentProofAt', 'paymentProofByName', 'paymentProofByUid', 'paymentProofName', 'paymentProofUrl'
    ]);
    assert.ok(!fields.includes('status'), 'a client must never be able to mark an invoice Paid');
    assert.ok(!fields.includes('amount'), 'the amount owed must stay as issued');
    // The uploader is stamped as themselves, not as whoever they claim.
    assert.match(rule, /request\.resource\.data\.paymentProofByUid == request\.auth\.uid/);
});

test('the proof upload reuses the audited client document path', () => {
    const app = read('app.js');
    const start = app.indexOf('async handlePaymentProofUpload(');
    const fn = app.slice(start, app.indexOf('async sendClientReply()', start));
    // Same Storage layout the storage rules already bound to the owning client.
    assert.match(fn, /client_documents\/\$\{clientDirectoryId\}\/\$\{storageFileName\}/);
    assert.match(fn, /validateClientDocumentFile\(file\)/);
    // Filed in the repository as well, so it is findable without the invoice.
    assert.match(fn, /purpose: 'Payment Proof'/);
    assert.match(fn, /linkedDocId: d\.id/);
    // And it never touches status.
    const update = fn.slice(fn.indexOf("updateDoc(doc(db, 'docs'"));
    assert.doesNotMatch(update.slice(0, 400), /status:/);
});

test('bulk actions operate on what the filter is showing, not the whole history', () => {
    const app = read('app.js');
    for (const fn of ['printAllClientDocuments', 'exportClientStatement']) {
        const start = app.indexOf(`${fn}(`);
        const body = app.slice(start, start + 400);
        assert.match(body, /this\.filteredClientPortalDocs/, `${fn} must respect the active filter`);
        assert.match(body, /if \(!items\.length\)/, `${fn} must handle an empty set`);
    }
});

test('every printed document but the last carries a page break', () => {
    const app = read('app.js');
    const start = app.indexOf('async printAllClientDocuments(');
    const fn = app.slice(start, app.indexOf('exportClientStatement(', start));
    // Without the i < length - 1 guard the final page prints blank.
    assert.match(fn, /i < pages\.length - 1/);
    assert.match(fn, /page-break-after: always/);
    // The form and print module are restored even if a document fails to render.
    assert.match(fn, /finally \{/);
    assert.match(fn, /this\.docForm = originalDoc;/);
});

test('the statement export goes through the shared CSV path', () => {
    const app = read('app.js');
    const start = app.indexOf('exportClientStatement()');
    const fn = app.slice(start, app.indexOf('viewClaimRecord(', start));
    // downloadCSV carries the BOM and csvSafeCell's formula-injection guard.
    assert.match(fn, /this\.downloadCSV\(rows,/);
    assert.doesNotMatch(fn, /data:text\/csv/, 'must not hand-roll a data URI');
});

test('the decision is stamped as the signed-in client, not as whoever is claimed', () => {
    // Found by driving the live rule with a real client token: without this the
    // client could accept their own quotation and attribute it to another uid,
    // which is precisely what recording the decider is for.
    const rule = docsRule();
    const branch = rule.slice(rule.indexOf("resource.data.type == 'Quotation'"));
    assert.match(branch, /request\.resource\.data\.clientDecisionByUid == request\.auth\.uid/);
});
