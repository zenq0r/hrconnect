const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource } = require('./helpers/sources');

// MODULE_ACTIONS is what the Staff Portal's Access panel shows an administrator
// about another account: what that role can change, and what it can delete, in
// each module. It used to be inferred from RBAC_ROLES alone and was wrong in
// both directions — a Delete tick on Reports, Claims and the Audit Log, which
// have no delete, and a cross against Finance on invoices, which it can delete.
//
// These tests hold the table to the gates the screens really use, for every
// role, so the panel cannot drift from the portal again.

const rbacSource = () => readSource('app/constants/rbac.js')
    .replace(/^import[\s\S]*?;\s*$/gm, '')
    .replace(/^export /gm, '');

function rbac() {
    return new Function(`${rbacSource()} return { RBAC_ROLES, MODULE_ACTIONS, MODULE_LABELS, moduleActionFor };`)();
}

const COMPUTED_GATES = [
    'isFullAccessRole', 'canDelete', 'canCreateClientTask', 'canManageProjects',
    'canManageDocuments', 'canDeleteBillingDocuments', 'canManagePayroll', 'canDeletePayroll',
    'canManageClients', 'canDeleteClients', 'canManageEmployees', 'canDeleteEmployees',
    'canManageCompanySettings', 'canManageStaffPortal', 'canCloseAccountingPeriod',
];

// The real gates, evaluated for a role: methods as methods, computed values as
// getters, the way Vue exposes them.
function gatesFor(role) {
    const source = rbacSource();
    const methods = new Function(`${source} return { ${methodSource('hasAccess', 'hasModulePermission')} };`)();
    const computed = new Function(`${source} return { ${methodSource(...COMPUTED_GATES)} };`)();
    const self = { userProfile: { role, email: 'someone@zenqor.com.my', uid: 'uid' } };
    Object.assign(self, methods);
    for (const [name, getter] of Object.entries(computed)) {
        Object.defineProperty(self, name, { get: () => getter.call(self) });
    }
    return self;
}

const CHECKS = {
    'client-task': { edit: g => g.canCreateClientTask, remove: g => g.canDelete },
    'project-activities': { edit: g => g.canManageProjects, remove: g => g.canManageProjects },
    'doc-generator': { edit: g => g.canManageDocuments, remove: g => g.canDeleteBillingDocuments },
    'payslip-generator': { edit: g => g.canManagePayroll, remove: g => g.canDeletePayroll },
    'client-directory': { edit: g => g.canManageClients, remove: g => g.canDeleteClients },
    'hr-employees': { edit: g => g.canManageEmployees, remove: g => g.canDeleteEmployees },
    'website-content': {
        edit: g => g.hasModulePermission('website-content', 'edit'),
        remove: g => g.hasModulePermission('website-content', 'delete'),
    },
    'settings': { edit: g => g.canManageCompanySettings },
    'reports': { edit: g => g.canCloseAccountingPeriod },
    'profile': { remove: g => g.canManageStaffPortal },
};

test('every module a role opens is described', () => {
    const { RBAC_ROLES, MODULE_ACTIONS } = rbac();
    for (const [role, modules] of Object.entries(RBAC_ROLES)) {
        for (const moduleName of modules) {
            assert.ok(MODULE_ACTIONS[moduleName], `${moduleName} (opened by ${role}) has no entry in MODULE_ACTIONS`);
        }
    }
});

test('"any record" in the table is exactly what the screen gates allow, for every role', () => {
    const { RBAC_ROLES, moduleActionFor } = rbac();
    for (const [moduleName, actions] of Object.entries(CHECKS)) {
        for (const [action, gate] of Object.entries(actions)) {
            for (const [role, modules] of Object.entries(RBAC_ROLES)) {
                if (!modules.includes(moduleName)) continue;
                const table = moduleActionFor(moduleName, action, role);
                const real = Boolean(gate(gatesFor(role)));
                assert.equal(table === true, real, `${role} / ${moduleName} / ${action}: table says ${JSON.stringify(table)}, the screen gate says ${real}`);
            }
        }
    }
});

test('Finance deletes invoices and quotations — the case the old panel got wrong', () => {
    const { moduleActionFor } = rbac();
    assert.equal(moduleActionFor('doc-generator', 'remove', 'Account'), true);
    assert.equal(gatesFor('Account').canDeleteBillingDocuments, true);
    // …while HR, who can create them, cannot delete them.
    assert.equal(moduleActionFor('doc-generator', 'remove', 'HR'), false);
});

test('modules with no delete say so, and really have none', () => {
    const { moduleActionFor, MODULE_ACTIONS } = rbac();

    // Claims and payment vouchers: approval moves a record on; nothing in the
    // portal deletes one. confirmDeleteRecord() does carry a claim branch, but
    // no control ever calls it for a claim or a voucher — the Recent Activity
    // button and its right-click entry are both limited to documents and
    // payslips. What counts is what a person can reach.
    assert.equal(moduleActionFor('claims', 'remove', 'Director'), null);
    const dashboard = readSource('views/tab-dashboard.html');
    for (const trigger of dashboard.matchAll(/<button v-if="([^"]*)"[^>]*@click="confirmDeleteRecord/g)) {
        assert.doesNotMatch(trigger[1], /isClaim|isVoucher/, 'a claim delete button now exists — update MODULE_ACTIONS');
    }
    const menu = methodSource('recentActivityMenuItems');
    const deleteEntry = menu.slice(menu.indexOf("label: 'Delete Record'") - 160, menu.indexOf("label: 'Delete Record'"));
    assert.doesNotMatch(deleteEntry, /isClaim|isVoucher/, 'a claim delete menu entry now exists — update MODULE_ACTIONS');
    assert.doesNotMatch(readSource('views/tab-claims.html'), /confirmDeleteRecord|deleteClaim|deletePaymentVoucher/);

    // The audit log is append-only, and the rules enforce it.
    assert.equal(moduleActionFor('audit-logs', 'remove', 'Superadmin'), null);
    assert.match(readSource('firestore.rules'), /match \/audit_logs\/\{logId\} \{[\s\S]*?allow create, update, delete: if false;/);

    // Reports export, and rebuild a closed month — nothing on it deletes.
    assert.equal(moduleActionFor('reports', 'remove', 'Director'), null);
    const reports = readSource('views/tab-reports.html');
    for (const handler of reports.matchAll(/@click="([^"(]+)/g)) {
        assert.match(handler[1], /^(export|rebuildMonthlyArchive$)/, `Reports now has another action (${handler[1]}) — update MODULE_ACTIONS`);
    }

    // Settings has nothing to delete.
    assert.equal(MODULE_ACTIONS.settings.remove, null);
});

test('the audit retention setting is changed by the roles the server admits', () => {
    const { MODULE_ACTIONS } = rbac();
    const server = readSource('api/audit-retention.js').match(/const ALLOWED_ROLES = new Set\(\[([^\]]+)\]\)/)[1];
    const allowed = [...server.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
    assert.deepEqual([...MODULE_ACTIONS['audit-logs'].edit.all].sort(), allowed);
});

test('the Access panel is drawn from the table, not from what a role opens', () => {
    const matrix = methodSource('staffPortalAccessMatrix');
    assert.match(matrix, /edit: moduleActionFor\(moduleName, 'edit', role\)/);
    assert.match(matrix, /remove: moduleActionFor\(moduleName, 'remove', role\)/);
    assert.doesNotMatch(matrix, /edit: true/);

    // And the panel can show all four answers.
    const panel = readSource('views/shared-modals.html');
    assert.match(panel, /v-if="entry\.remove === null"/);
    assert.match(panel, /v-else-if="entry\.remove === 'own'"/);
    assert.match(panel, /the module has no such action/);
});
