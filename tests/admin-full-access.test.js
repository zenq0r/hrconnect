const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource, constantSource } = require('./helpers/sources');

const appSource = () => readSource('app.js');

// Rebuild the access gates out of app.js with a stub `this`, so these exercise
// the shipped logic rather than a paraphrase of it.
function buildGates(role) {
    const gates = new Function(`
        ${constantSource('RBAC_ROLES')}
        return { ${methodSource('hasAccess', 'hasModulePermission')} };
    `)();
    gates.userProfile = { role };
    return gates;
}

const ADMINS = ['Superadmin', 'Director'];
const ADMIN_MODULES = [
    'dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator',
    'claims', 'client-directory', 'hr-employees', 'reports', 'website-content',
    'audit-logs', 'settings', 'profile'
];

test('an admin reaches every sidebar module, with edit and delete on each', () => {
    for (const role of ADMINS) {
        const gates = buildGates(role);
        for (const mod of ADMIN_MODULES) {
            assert.equal(gates.hasAccess(mod), true, `${role} should reach ${mod}`);
            assert.equal(gates.hasModulePermission(mod, 'edit'), true, `${role} needs edit on ${mod}`);
            assert.equal(gates.hasModulePermission(mod, 'delete'), true, `${role} needs delete on ${mod}`);
        }
        // Quotation and Invoice are the document permission under another name.
        assert.equal(gates.hasAccess('document-quotations'), true);
    }
});

test('admins do not gain the Client-only workspaces', () => {
    // These expect a client identity; opening them as staff renders nothing useful.
    for (const role of ADMINS) {
        const gates = buildGates(role);
        for (const mod of ['client-portal', 'client-documents', 'client-support']) {
            assert.equal(gates.hasAccess(mod), false, `${role} should not hold ${mod}`);
        }
    }
});

test('a non-admin role keeps its own boundary', () => {
    const staff = buildGates('Staff');
    assert.equal(staff.hasAccess('project-activities'), true);
    assert.equal(staff.hasAccess('hr-employees'), false, 'Staff must not reach HR');
    assert.equal(staff.hasAccess('client-directory'), false, 'Staff must not reach the Client Directory');
    assert.equal(staff.hasModulePermission('claims', 'delete'), false, 'delete stays with admins');

    // IT is a content admin for the public site, and only there.
    const it = buildGates('IT');
    assert.equal(it.hasModulePermission('website-content', 'delete'), true);
    assert.equal(it.hasModulePermission('settings', 'delete'), false);
});

test('the Director-only gates admit Superadmin', () => {
    const src = appSource();
    assert.match(src, /canCreateClientTask\(\) \{ return this\.isFullAccessRole; \}/);
    // The status map has no Superadmin key, so these must short-circuit before it.
    assert.match(src, /canApproveClaim\(clm\) \{[\s\S]{0,120}?if \(this\.isFullAccessRole\)/);
    assert.match(src, /canApprovePaymentVoucher\(pv\) \{[\s\S]{0,120}?if \(this\.isFullAccessRole\)/);
    assert.doesNotMatch(src, /if \(role === 'Director'\) return typeof/);
});

test('the Firestore approval branch matches the client gate', () => {
    const rules = readSource('firestore.rules');
    // claims and payment_vouchers now share one canUpdateClaimOrVoucher()
    // function rather than each carrying its own literal copy, so this
    // final-decision branch appears once, not twice — but both collections'
    // update rules must call into it. `admin` is that function's own
    // single-fetch isAdmin() equivalent (see the note above it).
    const branches = rules.match(/admin && isClaimDecision\(affected, \['Pending HR', 'Pending Account', 'Pending Director'\], \['Approved', 'Rejected'\], claimFinalDecisionKeys\(\)\)/g) || [];
    assert.equal(branches.length, 1, 'the shared final-decision branch must admit Superadmin');
    assert.match(rules, /let admin = staffSession && unlocked && sfa && \(record\.role == 'Superadmin' \|\| record\.role == 'Director'\);/, 'admin must mean exactly isSuperadmin() || isDirector()');
    const callers = rules.match(/allow update: if canUpdateClaimOrVoucher\(/g) || [];
    assert.equal(callers.length, 2, 'both claims and payment_vouchers must call the shared update rule');
    // A UI that permits what the rules refuse is worse than one that refuses first.
    assert.doesNotMatch(rules, /isDirector\(\) && resource\.data\.status in \['Pending HR'/);
});
