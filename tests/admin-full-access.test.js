const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const appSource = () => fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Rebuild the access gates out of app.js with a stub `this`, so these exercise
// the shipped logic rather than a paraphrase of it.
function buildGates(role) {
    const src = appSource();
    const mapStart = src.indexOf('const RBAC_ROLES = {');
    const mapEnd = src.indexOf('};', mapStart) + 2;
    const gateStart = src.indexOf('        hasAccess(moduleName) {');
    const gateEnd = src.indexOf('        formatCurrency(val) {', gateStart);
    assert.ok(mapStart > -1 && gateStart > -1 && gateEnd > gateStart, 'gates must remain in app.js');

    const gates = new Function(`
        ${src.slice(mapStart, mapEnd)}
        return { ${src.slice(gateStart, gateEnd)} };
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
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    const branches = rules.match(/isAdmin\(\) && resource\.data\.status in \['Pending HR', 'Pending Account', 'Pending Director'\]/g) || [];
    assert.equal(branches.length, 2, 'both claims and vouchers must admit Superadmin');
    // A UI that permits what the rules refuse is worse than one that refuses first.
    assert.doesNotMatch(rules, /isDirector\(\) && resource\.data\.status in \['Pending HR'/);
});
