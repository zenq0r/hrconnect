const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, readRaw, methodSource } = require('./helpers/sources');

// Email Address (Primary Contact) and Additional Authorized Emails are two
// separate Firestore fields (clientEmail, additionalClientEmails) that used
// to be reconciled by silently stripping the primary out of the additional
// list and deduplicating the rest with a Set — a typo or a re-entered
// primary address vanished with no explanation. Both are now validated up
// front and rejected with a specific message; nothing is auto-merged or
// auto-corrected on the person's behalf.

function buildClientMethods() {
    const obj = new Function(`return { ${methodSource('isValidEmailAddress', 'saveClientInformation')} }`)();
    obj.canManageClients = true;
    obj.customers = [];
    obj.notices = [];
    obj.showNotify = (message) => { obj.notices.push(message); return false; };
    obj.clientInformationModal = { saving: false, isEdit: false, form: baseForm() };
    return obj;
}

function baseForm(overrides = {}) {
    return {
        id: '', clientName: 'ACME SDN BHD', clientPhone: '+60123456789', clientAddress1: 'Level 1, Jalan ACME',
        clientPostcode: '50000', clientCity: 'Kuala Lumpur', clientState: 'Kuala Lumpur',
        clientEmail: '', additionalClientEmailsText: '', ...overrides
    };
}

test('Additional Authorized Emails is required — Save is refused until at least one is entered', async () => {
    const obj = buildClientMethods();
    obj.clientInformationModal.form = baseForm({ clientEmail: 'owner@acme.test', additionalClientEmailsText: '' });
    const result = await obj.saveClientInformation();
    assert.equal(result, false);
    assert.match(obj.notices.at(-1), /Additional Authorized Emails is required/);
});

test('a malformed address in either field is rejected by name, not silently dropped', async () => {
    const obj = buildClientMethods();

    obj.clientInformationModal.form = baseForm({ clientEmail: 'not-an-email', additionalClientEmailsText: 'finance@acme.test' });
    await obj.saveClientInformation();
    assert.match(obj.notices.at(-1), /"not-an-email" is not a valid Email Address/);

    obj.notices.length = 0;
    obj.clientInformationModal.form = baseForm({ clientEmail: 'owner@acme.test', additionalClientEmailsText: 'finance@acme' });
    await obj.saveClientInformation();
    assert.match(obj.notices.at(-1), /"finance@acme" in Additional Authorized Emails is not a valid email address/);
});

test('the primary Email Address re-entered inside Additional Authorized Emails is refused, never auto-copied or silently stripped', async () => {
    const obj = buildClientMethods();
    obj.clientInformationModal.form = baseForm({ clientEmail: 'owner@acme.test', additionalClientEmailsText: 'finance@acme.test, OWNER@acme.test' });
    const result = await obj.saveClientInformation();
    assert.equal(result, false);
    assert.match(obj.notices.at(-1), /"OWNER@acme\.test" is already used as the Email Address \(Primary Contact\)/);
});

test('a duplicate inside Additional Authorized Emails is refused even when the casing differs', async () => {
    const obj = buildClientMethods();
    obj.clientInformationModal.form = baseForm({ clientEmail: 'owner@acme.test', additionalClientEmailsText: 'finance@acme.test, Finance@ACME.test' });
    const result = await obj.saveClientInformation();
    assert.equal(result, false);
    assert.match(obj.notices.at(-1), /"Finance@ACME\.test" is listed more than once in Additional Authorized Emails/);
});

test('a clean, unique set of addresses is trimmed, lower-cased and passed through untouched', () => {
    const fn = methodSource('saveClientInformation');
    // Parsed from the raw comma-separated text once, kept as the exact
    // validated list — no second Set-based pass silently reshaping it.
    assert.match(fn, /rawAdditionalEntries = String\(form\.additionalClientEmailsText \|\| ''\)\.split\(','\)\.map\(entry => entry\.trim\(\)\)\.filter\(Boolean\)/);
    assert.match(fn, /additionalClientEmails\.push\(email\)/);
    assert.doesNotMatch(fn, /new Set\(String\(form\.additionalClientEmailsText/, 'duplicates must be rejected, not silently deduplicated');
});

test('Email Address and Additional Authorized Emails are stored as two separate Firestore fields, and read back separately', () => {
    const app = readSource('app.js');
    // Saved separately.
    assert.match(app, /clientEmail, clientPhone: String\(form\.clientPhone \|\| ''\)\.trim\(\)/);
    assert.match(app, /additionalClientEmails,/);
    // Read back separately when the record is reopened for editing — the
    // primary is never spliced into the additional list on load either.
    assert.match(app, /clientEmail: record\.clientEmail \|\| ''/);
    assert.match(app, /additionalClientEmails\.join\(', '\)/);
});

test('the Client Information form carries the requested labels, marks Additional Authorized Emails required, and shows the comma-separated example', () => {
    const markup = readRaw('views/tab-doc-generator.html');
    assert.match(markup, /Email Address &mdash; Primary Contact/);
    assert.match(markup, /Additional Authorized Emails \*/);
    assert.match(markup, /id="client-info-additional-email"[^>]*\brequired\b/);
    assert.match(markup, /Separate multiple email addresses with commas/);
    assert.match(markup, /finance@company\.com, admin@company\.com/);
});
