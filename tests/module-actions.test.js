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
    const methods = new Function(`${source} return { ${methodSource('hasAccess', 'hasModulePermission', 'canEditClaim', 'isOwnPendingRecord')} };`)();
    const computed = new Function(`${source} return { ${methodSource(...COMPUTED_GATES)} };`)();
    const self = { userProfile: { role, email: 'someone@zenqor.com.my', uid: 'uid' } };
    Object.assign(self, methods);
    for (const [name, getter] of Object.entries(computed)) {
        Object.defineProperty(self, name, { get: () => getter.call(self) });
    }
    return self;
}

const CHECKS = {
    'dashboard': {
        edit: g => g.canManageDocuments || g.canManagePayroll,
        remove: g => g.canDelete,
    },
    'claims': {
        // canEditClaim() of a record the viewer neither filed nor can see yet.
        edit: g => g.canEditClaim({ createdByUid: 'somebody-else', empEmail: 'else@zenqor.com.my', status: 'Pending Director' }),
        remove: g => g.canDelete,
    },
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

test('Superadmin and Director can change and delete in every module that has records', () => {
    const { RBAC_ROLES, MODULE_ACTIONS, moduleActionFor } = rbac();
    // Where a module has anything to change or delete, the full-access pair
    // does it to any record — never "own only", never refused. The modules
    // left with no delete at all are named, each for a stated reason below.
    const NOTHING_TO_DELETE = ['reports', 'audit-logs', 'settings'];
    for (const role of ['Director', 'Superadmin']) {
        for (const moduleName of RBAC_ROLES[role]) {
            const edit = moduleActionFor(moduleName, 'edit', role);
            const remove = moduleActionFor(moduleName, 'remove', role);
            assert.equal(edit, true, `${role} must be able to change any record in ${moduleName}`);
            if (NOTHING_TO_DELETE.includes(moduleName)) {
                assert.equal(remove, null, `${moduleName} was expected to have nothing to delete`);
            } else {
                assert.equal(remove, true, `${role} must be able to delete any record in ${moduleName}`);
            }
        }
    }
    assert.ok(MODULE_ACTIONS.claims.remove.all.includes('Director'));
});

test('each delete is on the module\'s own screen, not only somewhere else', () => {
    // Claims and vouchers: in both tables and both right-click menus.
    const claims = readSource('views/tab-claims.html');
    assert.match(claims, /<button v-if="canDelete"[^>]*@click="confirmDeleteRecord\(\{ \.\.\.clm, isClaim: true \}\)"/);
    assert.match(claims, /<button v-if="canDelete"[^>]*@click="confirmDeleteRecord\(\{ \.\.\.pv, isVoucher: true \}\)"/);
    assert.match(methodSource('claimRowMenuItems'), /this\.canDelete \? \{ label: 'Delete Claim Record'/);
    assert.match(methodSource('voucherRowMenuItems'), /this\.canDelete \? \{ label: 'Delete Voucher Record'/);
    // Claims and vouchers listed in Recent Activity can be deleted there too.
    // The button, the menu and the delete itself ask the same question, so
    // none of them offers a delete another would refuse.
    assert.match(readSource('views/tab-dashboard.html'), /<button v-if="canDeleteRecord\(item\)"[^>]*@click="confirmDeleteRecord\(item\)"/);
    assert.match(methodSource('recentActivityMenuItems'), /this\.canDeleteRecord\(item\) \? \{ label: 'Delete Record'/);
    assert.match(methodSource('confirmDeleteRecord'), /if \(!this\.canDeleteRecord\(item\)\)/);
    const gate = methodSource('canDeleteRecord');
    assert.match(gate, /if \(item\?\.isDoc\) return this\.canDeleteBillingDocument\(item\);/);
    assert.match(gate, /if \(item\?\.isPay\) return this\.canDeletePayroll;/);

    // Quotations, invoices and payslips: on their own screen while one is open.
    assert.match(readSource('views/tab-documents.html'), /<button v-if="editingDocId && canDeleteBillingDocument\(\{ type: docForm\.type \}\)"[^>]*@click="deleteOpenDocument"/);
    assert.match(readSource('views/tab-payslip.html'), /<button v-if="editingPayId && canDeletePayroll"[^>]*@click="deleteOpenPayslip"/);

    // Client Task: a visible button, not only the right-click menu.
    assert.match(readSource('views/tab-client-task.html'), /<button v-if="canDelete"[^>]*@click\.stop="requestDeleteClientTask\(cust\)"/);
});

test('an administrator\'s correction of a claim is stamped, audited, and kept apart from approval', () => {
    const rules = readSource('firestore.rules');
    const correction = rules.slice(rules.indexOf('function isAdminClaimCorrection()'), rules.indexOf('match /settings/'));
    assert.match(correction, /isAdmin\(\) &&/);
    // The status cannot move in the same write, so an amount is never changed
    // inside an approval.
    assert.match(correction, /request\.resource\.data\.status == resource\.data\.status/);
    assert.match(correction, /request\.resource\.data\.lastEditedByUid == request\.auth\.uid/);
    assert.equal((rules.match(/allow update: if isAdminClaimCorrection\(\) \|\| \(/g) || []).length, 2, 'claims and payment_vouchers');
    // Approvals still may not touch the amount.
    assert.equal((rules.match(/claimAmountUnchanged\(\)/g) || []).length, 7, 'six approval transitions plus the definition');

    const claims = readSource('app/methods/claims.js');
    assert.match(claims, /canEditClaim\(clm\) \{\s*return this\.isFullAccessRole \|\|/);
    assert.match(claims, /canEditPaymentVoucher\(pv\) \{\s*return this\.isFullAccessRole \|\|/);
    assert.match(methodSource('adminCorrectionStamp'), /lastEditedByUid: auth\.currentUser\.uid/);
    assert.equal((claims.match(/if \(adminCorrection\) Object\.assign\(payload, this\.adminCorrectionStamp\(\)\);/g) || []).length, 2, 'claims and payment vouchers');
    assert.match(claims, /this\.logAudit\('UPDATE', `Corrected expense claim/);
    assert.match(claims, /this\.logAudit\('UPDATE', `Corrected payment voucher/);
    // And editing no longer throws a claim back into HR's queue.
    assert.match(methodSource('recordAssignment'), /isEdit \? \(form\[field\] \?\? fallback\) : fallback/);
    assert.match(claims, /\.\.\.this\.recordAssignment\(this\.claimForm, this\.editingClaimId, assignee\)/);
    assert.match(claims, /\.\.\.this\.recordAssignment\(this\.voucherForm, this\.editingVoucherId, assignee\)/);

    // Every delete of a financial record is written to the audit log.
    assert.match(methodSource('confirmDeleteRecord'), /this\.logAudit\('DELETE', `Deleted \$\{kind\.toLowerCase\(\)\}/);
});

test('every audit action the portal sends is one the server records', () => {
    const allowed = new Set([...readSource('api/audit-log.js').match(/const ALLOWED_ACTIONS = new Set\(\[([\s\S]*?)\]\);/)[1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]));
    // Every verb in the first argument, including both sides of a ternary
    // such as logAudit(locking ? 'LOCK' : 'UNLOCK', ...).
    const sent = new Set([...readSource('app.js').matchAll(/logAudit\(([^,]*'[A-Z_]+'[^,]*),/g)]
        .flatMap(call => [...call[1].matchAll(/'([A-Z_]+)'/g)].map(m => m[1])));
    assert.ok(sent.has('LOCK') && sent.has('UNLOCK'), 'verbs chosen by a ternary are checked too');
    const refused = [...sent].filter(action => !allowed.has(action));
    // A verb the server does not list is refused with a 400 the portal never
    // shows, and the event is simply not recorded.
    assert.deepEqual(refused, [], `the audit log silently refuses: ${refused.join(', ')}`);
});

test('modules with no delete say so, and really have none', () => {
    const { moduleActionFor, MODULE_ACTIONS } = rbac();

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
    assert.match(panel, /v-for="answer in \[entry\.edit, entry\.remove\]"/);
    assert.match(panel, /v-if="answer === null"/);
    assert.match(panel, /v-else-if="answer === 'own'"/);
    assert.match(panel, /the module has no such action/);
});
