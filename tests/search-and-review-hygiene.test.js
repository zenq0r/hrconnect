const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource } = require('./helpers/sources');

// The top-nav search box promises "Search Documents, Employees, TIN, ID..."
// but for a long time only actually filtered Claims, Vouchers, Recent
// Activity and Projects — typing an employee's name or a client's TIN on
// the wrong screen did nothing, with no message saying so. These lock in
// that the promise now holds for the two screens it previously skipped,
// and that switching tabs does not leave stale search text silently
// filtering an unrelated screen's KPI counts.

test('the Client Directory table is filtered by the same search box that promises it', () => {
    const filtered = methodSource('filteredCustomers');
    assert.match(filtered, /this\.searchQuery/);
    assert.match(filtered, /clientName.*clientId.*clientSSM.*clientContactPerson.*clientEmail.*clientPhone/s);

    const markup = readSource('index.html');
    assert.match(markup, /v-for="\(cust, idx\) in filteredCustomers"/);
    assert.doesNotMatch(markup, /v-for="\(cust, idx\) in customers"/);
});

test('the Audit & Security Log is filtered by the same search box that promises it', () => {
    const filtered = methodSource('filteredAuditLogs');
    assert.match(filtered, /this\.searchQuery/);
    assert.match(filtered, /this\.auditLogs/);

    const markup = readSource('index.html');
    assert.match(markup, /v-for="log in filteredAuditLogs"/);
    assert.doesNotMatch(markup, /v-for="log in auditLogs"/);
});

test('switching tabs clears the search box instead of silently re-filtering the next screen', () => {
    const switchTab = methodSource('switchTab');
    // Cleared only on a real tab change — the early return for re-clicking
    // the tab already open must come before it, or a user's in-progress
    // search on their own current screen would be wiped by nothing.
    const clearAt = switchTab.indexOf("this.searchQuery = '';");
    const currentTabCheckAt = switchTab.indexOf('this.currentTab = tabName;');
    assert.ok(clearAt > -1, 'switchTab must clear searchQuery on a real navigation');
    assert.ok(clearAt > currentTabCheckAt);
});

test('the one deliberate search handoff survives the tab-switch clear', () => {
    // viewEmployeeProjectAssignments() hands a filter to Project Activities on
    // purpose (HR -> "this employee's projects"). It must set searchQuery
    // AFTER switchTab(), or the clear added above would wipe it right back out.
    const fn = methodSource('viewEmployeeProjectAssignments');
    const switchAt = fn.indexOf('this.switchTab(');
    const searchAt = fn.indexOf('this.searchQuery =');
    assert.ok(switchAt > -1 && searchAt > -1);
    assert.ok(searchAt > switchAt, 'searchQuery must be set after switchTab(), not before it');
});

test('verifying a payment proof names the invoice\'s own reference to check it against', () => {
    // A client's bank transfer form lets them type any reference they like,
    // and a mismatched one is exactly how a payment gets credited to the
    // wrong invoice. Nothing here can read the uploaded proof itself, but the
    // confirmation dialog can at least put the invoice's own reference in
    // front of whoever is about to approve it.
    const fn = methodSource('reviewPaymentProof');
    assert.match(fn, /invoice\.paymentRefNo/);
    assert.match(fn, /Check the reference on the proof/);
});
