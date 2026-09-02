const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const appSource = () => fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Rebuild the two gates out of app.js with a stub `this`, so these exercise the
// shipped logic rather than a paraphrase of it.
function buildGates(role, customAccess) {
    const src = appSource();
    const mapStart = src.indexOf('const RBAC_ROLES = {');
    const mapEnd = src.indexOf('};', mapStart) + 2;
    const accessStart = src.indexOf('        hasAccess(moduleName) {');
    const accessEnd = src.indexOf('        // Toggles a module', accessStart);
    assert.ok(mapStart > -1 && accessStart > -1 && accessEnd > accessStart, 'gates must remain in app.js');

    const factory = new Function(`
        ${src.slice(mapStart, mapEnd)}
        return { ${src.slice(accessStart, accessEnd)} };
    `);
    const gates = factory();
    gates.userProfile = { role, customAccess };
    gates.isFullAccessRole = ['Superadmin', 'Director'].includes(role);
    return gates;
}

const ADMINS = ['Superadmin', 'Director'];
// Every sidebar module an admin role is listed for.
const ADMIN_MODULES = [
    'dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator',
    'claims', 'client-directory', 'hr-employees', 'reports', 'website-content',
    'audit-logs', 'settings', 'profile'
];

test('an admin reaches every module in their role list', () => {
    for (const role of ADMINS) {
        const gates = buildGates(role, {});
        for (const mod of ADMIN_MODULES) {
            assert.equal(gates.hasAccess(mod), true, `${role} should reach ${mod}`);
        }
    }
});

test('a stored override cannot hide a module from an admin', () => {
    // This is the shape the Portal Access form writes when someone unticks a page.
    const revokeEverything = Object.fromEntries(
        ADMIN_MODULES.map(mod => [mod, { view: false, edit: false, delete: false }])
    );
    for (const role of ADMINS) {
        const gates = buildGates(role, revokeEverything);
        for (const mod of ADMIN_MODULES) {
            assert.equal(gates.hasAccess(mod), true, `${role} kept out of ${mod} by an override`);
            assert.equal(gates.hasModulePermission(mod, 'edit'), true, `${role} lost edit on ${mod}`);
            assert.equal(gates.hasModulePermission(mod, 'delete'), true, `${role} lost delete on ${mod}`);
        }
    }
});

test('an override still applies to a non-admin role', () => {
    const gates = buildGates('HR', { 'hr-employees': { view: false, edit: false, delete: false } });
    assert.equal(gates.hasAccess('hr-employees'), false, 'HR override must still take effect');
    assert.equal(gates.hasAccess('claims'), true, 'unrelated modules stay reachable');
});

test('admins do not gain the Client-only workspaces', () => {
    // These expect a client identity; reaching them as staff renders nothing useful.
    for (const role of ADMINS) {
        const gates = buildGates(role, {});
        for (const mod of ['client-portal', 'client-documents', 'client-support']) {
            assert.equal(gates.hasAccess(mod), false, `${role} should not hold ${mod}`);
        }
    }
});

test('the Director-only gates now admit Superadmin', () => {
    const src = appSource();
    assert.match(src, /canCreateClientTask\(\) \{ return this\.isFullAccessRole; \}/);
    // The status map has no Superadmin key, so these must short-circuit before it.
    assert.match(src, /canApproveClaim\(clm\) \{[\s\S]{0,120}?if \(this\.isFullAccessRole\)/);
    assert.match(src, /canApprovePaymentVoucher\(pv\) \{[\s\S]{0,120}?if \(this\.isFullAccessRole\)/);
    assert.doesNotMatch(src, /if \(role === 'Director'\) return typeof/);
});

test('the Firestore approval branch matches the client gate', () => {
    const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    // Claims and payment vouchers both settle at the final approval step.
    const branches = rules.match(/isAdmin\(\) && resource\.data\.status in \['Pending HR', 'Pending Account', 'Pending Director'\]/g) || [];
    assert.equal(branches.length, 2, 'both claims and vouchers must admit Superadmin');
    // A UI that permits what the rules refuse is worse than one that refuses first.
    assert.doesNotMatch(rules, /isDirector\(\) && resource\.data\.status in \['Pending HR'/);
});
