const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readSource } = require('./helpers/sources');

const read = name => readSource(name);
const appSource = () => read('app.js');
const markup = () => read('index.html');

// Rebuild the presence gate out of app.js with a stub `this`, so these exercise
// the shipped logic rather than a paraphrase of it.
function buildPresence({ employees = [], customers = [], now = 1_000_000 } = {}) {
    const src = appSource();
    const start = src.indexOf('        isPresenceAnchored(user) {');
    const end = src.indexOf('        isClientOnline(clientDirectoryId) {');
    assert.ok(start > -1 && end > start, 'the presence gate must remain in app.js');

    const gate = new Function(`
        const FULL_ACCESS_ROLES = ['Superadmin', 'Director'];
        return { ${src.slice(start, end)} };
    `)();
    gate.employees = employees;
    gate.customers = customers;
    gate.presenceNow = now;
    gate.isSeedAdminEmail = email => ['info@zenqor.com.my', 'admin@zenq0r.com'].includes(String(email || '').toLowerCase());
    gate.getPresenceTime = value => (value ? Date.parse(value) : 0);
    // The real computed, rebuilt the same way.
    const anchorSrc = src.slice(src.indexOf('        presenceAnchorEmails() {'), src.indexOf('        canViewStaffDirectory()'));
    const anchorFn = new Function(`return { ${anchorSrc} };`)().presenceAnchorEmails;
    Object.defineProperty(gate, 'presenceAnchorEmails', { get: () => anchorFn.call(gate) });
    return gate;
}

const ONLINE = { presenceStatus: 'Online', presenceUpdatedAt: new Date(1_000_000 - 5_000).toISOString() };

test('an account with no Staff ID and no Client ID never lights up as online', () => {
    const gate = buildPresence({ employees: [], customers: [] });
    for (const role of ['Director', 'HR', 'Account', 'IT', 'Staff']) {
        assert.equal(
            gate.isPortalUserOnline({ ...ONLINE, role, email: 'nobody@zenqor.com.my' }),
            false,
            `${role} must stay offline without an employee record`
        );
    }
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Client', email: 'nobody@client.test' }), false);
});

test('Super Admin is the one role exempt from needing a directory record', () => {
    const gate = buildPresence({ employees: [], customers: [] });
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Superadmin', email: 'boss@zenqor.com.my' }), true);
    // The protected bootstrap account too - it runs the portal from outside the
    // HR directory by design.
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'IT', email: 'info@zenqor.com.my' }), true);
    // Director is deliberately NOT exempt: a Director is a member of staff.
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Director', email: 'dir@zenqor.com.my' }), false);
});

test('the indicator lights up once the email is stored on a Staff ID', () => {
    const gate = buildPresence({ employees: [{ empNo: 'ZEN-1', email: 'Dir@Zenqor.Com.My' }] });
    // Matched case-insensitively, the same way every other email check here is.
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Director', email: 'dir@zenqor.com.my' }), true);
    assert.equal(gate.isEmployeeOnline({ ...ONLINE, email: 'dir@zenqor.com.my' }), true);
});

test('a Client lights up from its Client ID, including a secondary contact', () => {
    const gate = buildPresence({
        customers: [{ id: 'c1', clientName: 'ACME', clientEmail: 'primary@acme.test', additionalClientEmails: ['finance@acme.test'] }]
    });
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Client', email: 'primary@acme.test' }), true);
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Client', email: 'finance@acme.test' }), true);
    assert.equal(gate.isPortalUserOnline({ ...ONLINE, role: 'Client', email: 'stranger@acme.test' }), false);
});

test('anchoring gates presence, it does not replace the staleness check', () => {
    const gate = buildPresence({ employees: [{ empNo: 'ZEN-1', email: 'staff@zenqor.com.my' }] });
    // Anchored, but the last heartbeat is older than the 90s window.
    const stale = { presenceStatus: 'Online', presenceUpdatedAt: new Date(1_000_000 - 120_000).toISOString() };
    assert.equal(gate.isPortalUserOnline({ ...stale, role: 'Staff', email: 'staff@zenqor.com.my' }), false);
    // Anchored and fresh, but reported Offline.
    assert.equal(gate.isPortalUserOnline({ presenceStatus: 'Offline', presenceUpdatedAt: new Date(1_000_000 - 5_000).toISOString(), role: 'Staff', email: 'staff@zenqor.com.my' }), false);
});

test('Super Admin can approve and reject from the record preview', () => {
    const html = markup();
    // canApproveClaim()/canApprovePaymentVoucher() both return true for either
    // full-access role, and firestore.rules admits isAdmin() at every Pending
    // stage - so the markup must not narrow that to Director alone.
    assert.match(html, /v-if="isFullAccessRole && \(claimPreview\.claim\.documentType/);
    assert.doesNotMatch(html, /v-if="userProfile\.role === 'Director' && \(claimPreview/);

    const app = appSource();
    for (const gate of ['canApproveClaim(clm)', 'canApprovePaymentVoucher(pv)']) {
        const body = app.slice(app.indexOf(gate), app.indexOf(gate) + 400);
        assert.match(body, /if \(this\.isFullAccessRole\) return/, `${gate} must admit both admins`);
    }
});

test('bulk approve is withheld from both admins, in the markup as well as the method', () => {
    const app = appSource();
    // The method refuses it for either full-access role: a final approval needs
    // its own supporting document, one record at a time.
    for (const fn of ['async bulkApproveSelectedClaims()', 'async bulkApproveSelectedVouchers()']) {
        const body = app.slice(app.indexOf(fn), app.indexOf(fn) + 260);
        assert.match(body, /if \(this\.isFullAccessRole\) \{ this\.showNotify/, `${fn} must refuse full-access roles`);
    }
    // So the button and its selection column must be hidden from both, rather
    // than shown to Super Admin and rejected on click.
    const html = markup();
    assert.match(html, /v-if="!isFullAccessRole && selectedClaimIds\.length"/);
    assert.match(html, /v-if="!isFullAccessRole && selectedVoucherIds\.length"/);
    assert.equal((html.match(/v-if="!isFullAccessRole" class="w-8"/g) || []).length, 2, 'both selection header cells');
    assert.equal((html.match(/<td v-if="!isFullAccessRole">/g) || []).length, 2, 'both selection body cells');
    assert.doesNotMatch(html, /userProfile\.role !== 'Director'/);
});

test('the approve button is labelled by the record stage, not by who is reading it', () => {
    // Super Admin approving a claim already at Pending Director is making the
    // final decision; the old label told them it would be forwarded onward.
    assert.match(markup(), /claimPreview\.claim\.status === 'Pending Director' \? 'Final Approve' : 'Approve & Forward'/);
});

test('presence is written to the record that stores your email, never one that stores your uid', () => {
    const src = appSource();
    const fn = src.slice(src.indexOf('async setCurrentEmployeePresence(isOnline)'), src.indexOf('async startPresenceTracking()'));
    assert.ok(fn.length > 0, 'setCurrentEmployeePresence must remain in app.js');

    // The record is chosen by email and by nothing else. Choosing it by
    // presenceUid without also checking the email let one account's heartbeat
    // land on another account's record: once a record carried somebody else's
    // uid the uid branch always won, so it could never recover on its own.
    assert.match(fn, /const employee = this\.employees\.find\(emp => String\(emp\.email \|\| ''\)\.trim\(\)\.toLowerCase\(\) === email\);/);
    assert.doesNotMatch(fn, /find\(emp => emp\.presenceUid === auth\.currentUser\.uid\)/, 'the uid lookup must not come back');

    // presenceUid is still stamped on the write - firestore.rules checks it -
    // it is simply no longer trusted to say which record to write to.
    assert.match(fn, /presenceUid: auth\.currentUser\.uid/);
});

test('a Client login may not use a company domain, and staff may use nothing else', () => {
    const src = appSource();
    const start = src.indexOf('        isPortalEmailAllowed(email, role) {');
    const end = src.indexOf('        portalEmailRejectionMessage(role) {');
    assert.ok(start > -1 && end > start, 'the portal email gate must remain in app.js');
    const gate = new Function(`return { ${src.slice(start, end)} };`)();
    gate.allowedStaffDomains = ['zenq0r.com', 'zenqor.com.my'];
    gate.isStaffEmail = function (email) {
        const e = String(email || '').toLowerCase().trim();
        return /^[^\s@]+@[^\s@]+$/.test(e) && this.allowedStaffDomains.includes(e.split('@')[1]);
    };

    // A Client is somebody outside the company, so a company address is not a
    // valid Client identity - both company domains, not just the one asked about.
    for (const email of ['orang@zenqor.com.my', 'ORANG@ZENQOR.COM.MY', 'orang@zenq0r.com']) {
        assert.equal(gate.isPortalEmailAllowed(email, 'Client'), false, `${email} must be refused as a Client`);
    }
    // Real client addresses keep working - these are the ones actually in use.
    for (const email of ['zenqort@gmail.com', 'azziemahmad@gmail.com', 'azrul@monsta.com', 'nurhaniffzaid@publicimage.asia']) {
        assert.equal(gate.isPortalEmailAllowed(email, 'Client'), true, `${email} must still sign in as a Client`);
    }
    // And the original direction is untouched.
    for (const role of ['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff']) {
        assert.equal(gate.isPortalEmailAllowed('person@zenqor.com.my', role), true);
        assert.equal(gate.isPortalEmailAllowed('person@gmail.com', role), false);
    }
});

test('the refusal is phrased for the side it failed on', () => {
    const src = appSource();
    const start = src.indexOf('        portalEmailRejectionMessage(role) {');
    const fn = src.slice(start, start + 420);
    // Telling a Client that staff sign-in needs @zenqor.com.my reads as an
    // instruction to go and get one.
    assert.match(fn, /role === 'Client'/);
    assert.match(fn, /Client access cannot use a company address/);
    assert.match(fn, /Staff and Management sign-in requires/);
    // Both sign-in paths use it rather than hardcoding the staff wording.
    assert.equal((src.match(/this\.loginError = this\.portalEmailRejectionMessage\(role\);/g) || []).length, 2);
});

test('the rule is enforced server-side too, not only in the portal forms', () => {
    const rulesSrc = read('firestore.rules');
    const fn = rulesSrc.slice(rulesSrc.indexOf('function hasAllowedRoleEmail(data)'), rulesSrc.indexOf('// Multi-user Client Portal access'));
    assert.match(fn, /data\.role == 'Client' && !hasApprovedCompanyEmail\(data\.email\)/);
    assert.match(fn, /data\.role != 'Client' && hasApprovedCompanyEmail\(data\.email\)/);

    // And in the claims endpoint, so an account created straight in the Firebase
    // console - past every form - still cannot reach Storage as a Client.
    const api = read(path.join('api', 'sync-user-claims.js'));
    assert.match(api, /if \(role === 'Client' && isApprovedStaffEmail\(email\)\) \{/);
});
