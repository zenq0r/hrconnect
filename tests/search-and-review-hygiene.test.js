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

test('a document still reaches the client when the Storage bucket refuses CORS', () => {
    // Forcing a Save-As with the real filename needs a fetch() against the
    // Storage bucket, which needs the bucket's CORS config to admit this
    // origin — confirmed live that it currently does not, so every attempt
    // failed with a bare "Unable to download this document" toast and no
    // way to reach the file at all. A failed fetch must fall back to the
    // same plain-navigation window.open() viewClientDocument() already
    // uses, which needs no CORS.
    const fn = methodSource('downloadClientDocument');
    const tryAt = fn.indexOf('await fetch(item.downloadURL)');
    const catchAt = fn.indexOf('catch (error)');
    const openAt = fn.indexOf("window.open(item.downloadURL, '_blank', 'noopener')");
    assert.ok(tryAt > -1, 'must still attempt the forced-filename download first');
    assert.ok(catchAt > tryAt && openAt > catchAt, 'a failed fetch must fall back to window.open() in the catch block');
});

test('a toast only joins the persisted notifications feed when it is worth keeping', () => {
    // notificationsLog used to grow on every single showNotify() call —
    // hundreds of routine confirmations, validation refusals, and other
    // people's "is now online" pings a minute apart, none of it worth
    // scrolling back through later. The toast itself still fires either
    // way; only the permanent bell-feed entry is now gated.
    const showNotify = methodSource('showNotify');
    const guardAt = showNotify.indexOf('if (this.isNotableForNotificationsLog(msg, resolvedTone)) {');
    const unshiftAt = showNotify.indexOf('this.notificationsLog.unshift(');
    assert.ok(guardAt > -1 && unshiftAt > guardAt, 'notificationsLog.unshift must sit inside the isNotableForNotificationsLog guard');

    const isNotable = methodSource('isNotableForNotificationsLog');
    assert.match(isNotable, /if \(tone === 'error'\) return false;/, 'this account\'s own validation/permission refusals must not clutter the feed');
    assert.match(isNotable, /is now \(online\|offline\)/, 'another user\'s presence pings must not clutter the feed');
});

test('Recent Activities shows exactly when a record was created, not just its editable business date', () => {
    // item.date is a business date the record's own type defines (Document
    // Date, Expense Date, Payment Date) — staff enter it by hand and can
    // backdate it, so it never carries a time of day. recordCreatedAt() is
    // the separate, precise moment the record was actually saved.
    const obj = new Function(`return { ${methodSource('recordCreatedAt', 'formatDateTime')} }`)();

    // Claims and vouchers stamp createdAt explicitly — prefer it.
    const fromCreatedAt = obj.recordCreatedAt({ id: '1000000000000', createdAt: '2026-09-14T07:30:00.000Z' });
    assert.match(fromCreatedAt, /2026/);
    assert.notEqual(fromCreatedAt, '');

    // Docs and payslips never set createdAt, but every save mints the
    // Firestore doc id as String(Date.now()) — fall back to decoding it.
    const nowMillis = Date.now();
    const fromId = obj.recordCreatedAt({ id: String(nowMillis) });
    assert.notEqual(fromId, '', 'a Date.now()-shaped id must still produce a created-at time');

    // A legacy non-numeric id with no createdAt must not print a bogus date.
    assert.equal(obj.recordCreatedAt({ id: 'legacy-SAZT-262808' }), '');
    assert.equal(obj.recordCreatedAt({ id: undefined }), '');
});

test('the Recent Activities Date column renders the created-at detail', () => {
    const { readRaw } = require('./helpers/sources');
    const markup = readRaw('views/tab-dashboard.html');
    const dateCell = markup.slice(markup.indexOf('{{ item.date }}') - 200, markup.indexOf('{{ item.date }}') + 300);
    assert.match(dateCell, /v-if="recordCreatedAt\(item\)"/);
    assert.match(dateCell, /Created \{\{ recordCreatedAt\(item\) \}\}/);
});
