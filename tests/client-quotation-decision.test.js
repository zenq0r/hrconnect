const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
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

test('staff keep their own write path, and delete stays with admins', () => {
    const rule = docsRule();
    assert.match(rule, /allow create: if isSuperadmin\(\) \|\| isDirector\(\) \|\| isHR\(\) \|\| isAccount\(\);/);
    assert.match(rule, /allow update: if \(isSuperadmin\(\) \|\| isDirector\(\) \|\| isHR\(\) \|\| isAccount\(\)\) \|\|/);
    assert.match(rule, /allow delete: if isAdmin\(\);/);
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
