// Role-based access control: which role opens which module, which pair holds
// full access, and the Staff Portal action lists every surface is built from.
import {
    doc
} from "../../firebase-config.js";
export const RBAC_ROLES = {
    // 'website-content' manages the public zenqor-tech site's Firestore-backed
    // Portfolio galleries (portfolio_web = Digital Systems, portfolio_gaming =
    // Licensing & Permits), the Services page, and page-text overrides
    // (content/site_text). Restricted to Superadmin/Director/IT only — see
    // isContentAdmin() in firestore.rules, which grants write on exactly these
    // collections to that same set of roles (not the full isAdmin() surface).
    'Director': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Superadmin': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'website-content', 'audit-logs', 'settings', 'profile'],
    'HR': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'hr-employees', 'reports', 'profile'],
    'Account': ['dashboard', 'client-task', 'project-activities', 'doc-generator', 'payslip-generator', 'claims', 'client-directory', 'reports', 'profile'],
    'IT': ['dashboard', 'project-activities', 'website-content', 'audit-logs', 'settings', 'profile'],
    'Client': ['project-activities', 'client-portal', 'client-documents', 'client-updates', 'client-support', 'profile'],
    'Staff': ['dashboard', 'project-activities', 'claims', 'profile']
};

// Human names for the RBAC modules above. The sidebar writes its own labels
// inline; the Staff Portal's Access panel needs them as data so it can print
// one row per module of whichever role it is describing.
export const MODULE_LABELS = {
    'dashboard': 'Dashboard',
    'client-task': 'Client Task',
    'project-activities': 'Project Activities',
    'doc-generator': 'Quotation & Invoice',
    'payslip-generator': 'Payroll Management',
    'claims': 'Claims & Vouchers',
    'client-directory': 'Client Registration',
    'hr-employees': 'HR Employees',
    'reports': 'Reports & Analytics',
    'website-content': 'Website Management',
    'audit-logs': 'Audit & Security Log',
    'settings': 'Global Company Settings',
    'profile': 'Profile & Portal Access',
    'client-portal': 'Client Workspace',
    'client-documents': 'Client Documents',
    'client-updates': 'Project Updates',
    'client-support': 'Help & Support'
};

// The two roles that hold every module with every interaction on it, and the
// only two that may press a Staff Portal button that writes. Named once here
// because six separate places used to repeat the pair inline.
export const FULL_ACCESS_ROLES = ['Superadmin', 'Director'];

// What each module actually lets somebody change or remove — not what a role
// can open (that is RBAC_ROLES). The Staff Portal's Access panel is drawn from
// this, and it used to be drawn from RBAC_ROLES alone: every module a role
// opened was shown as editable, and every module was shown as deletable for
// Superadmin and Director, including Reports, the Audit Log and Claims, which
// have no delete at all. It also showed Finance unable to delete invoices,
// which it can.
//
// For each action:
//   null      — the module has no such action for anybody
//   all       — roles that may do it to any record
//   own       — roles that may do it only to records they created, or a
//               project they are Person In Charge of
//
// Every entry is checked against the gates the screens actually use by
// tests/module-actions.test.js, so this table cannot quietly drift from them.
const STAFF_ROLES = ['Director', 'Superadmin', 'HR', 'Account', 'IT', 'Staff'];
export const MODULE_ACTIONS = {
    'dashboard': {
        edit: { all: ['Director', 'Superadmin', 'HR', 'Account'] },
        remove: { all: FULL_ACCESS_ROLES },
        note: 'Recent Activity and the billing queue act on invoices, payslips, claims and vouchers. Finance can also delete invoices and quotations here.',
    },
    'client-task': {
        edit: { all: FULL_ACCESS_ROLES },
        remove: { all: FULL_ACCESS_ROLES },
    },
    'project-activities': {
        edit: { all: FULL_ACCESS_ROLES, own: ['HR', 'Account', 'IT', 'Staff'] },
        remove: { all: FULL_ACCESS_ROLES },
        note: 'A Person In Charge edits their own projects and schedules their activities.',
    },
    'doc-generator': {
        edit: { all: ['Director', 'Superadmin', 'HR', 'Account'] },
        remove: { all: ['Director', 'Superadmin', 'Account'] },
        note: 'Quotations, invoices and Client Information. Only invoices and quotations can be deleted.',
    },
    'payslip-generator': {
        edit: { all: ['Director', 'Superadmin', 'HR', 'Account'] },
        remove: { all: FULL_ACCESS_ROLES },
    },
    'claims': {
        edit: { all: FULL_ACCESS_ROLES, own: ['HR', 'Account', 'Staff'] },
        remove: { all: FULL_ACCESS_ROLES },
        note: 'Submitters edit their own claim while it is Pending HR. Superadmin and Director correct any claim at any stage — recorded, and never in the same step as an approval.',
    },
    'client-directory': {
        edit: { all: ['Director', 'Superadmin', 'HR', 'Account'] },
        remove: { all: FULL_ACCESS_ROLES },
    },
    'hr-employees': {
        edit: { all: ['Director', 'Superadmin', 'HR'] },
        remove: { all: FULL_ACCESS_ROLES },
    },
    'reports': {
        edit: { all: FULL_ACCESS_ROLES },
        remove: null,
        note: 'Export for everyone. Superadmin and Director can also rebuild a closed month from the records currently on file.',
    },
    'website-content': {
        edit: { all: ['Director', 'Superadmin', 'IT'] },
        remove: { all: ['Director', 'Superadmin', 'IT'] },
    },
    'audit-logs': {
        edit: { all: ['Director', 'Superadmin', 'IT'] },
        remove: null,
        note: 'Only the retention period can be changed. Entries can never be edited or deleted — not even by Superadmin — or the log could not show what an administrator did.',
    },
    'settings': {
        edit: { all: ['Director', 'Superadmin', 'IT'] },
        remove: null,
    },
    'profile': {
        edit: { all: FULL_ACCESS_ROLES, own: STAFF_ROLES.filter(role => !FULL_ACCESS_ROLES.includes(role)).concat('Client') },
        remove: { all: FULL_ACCESS_ROLES },
        note: 'Everyone edits their own profile. Superadmin and Director also manage and delete portal accounts.',
    },
    'client-portal': {
        edit: { own: ['Client'] },
        remove: null,
        note: 'Accept or decline their own quotations and send payment proof.',
    },
    'client-documents': {
        edit: { own: ['Client'] },
        remove: { all: ['Director', 'Superadmin', 'HR', 'Account'] },
        note: 'Clients upload to their own folder; only staff remove a file.',
    },
    'client-updates': {
        edit: { all: FULL_ACCESS_ROLES, own: ['Client'] },
        remove: { all: FULL_ACCESS_ROLES, own: ['Client'] },
        note: 'Clients reply on Premium and above, and may edit or delete their own replies.',
    },
    'client-support': { edit: null, remove: null },
};

// true — any record; 'own' — only their own; false — not permitted; null — no
// such action exists in this module.
export function moduleActionFor(moduleName, action, role) {
    const entry = MODULE_ACTIONS[moduleName];
    if (!entry || entry[action] === null || entry[action] === undefined) return null;
    const rule = entry[action];
    if ((rule.all || []).includes(role)) return true;
    if ((rule.own || []).includes(role)) return 'own';
    return false;
}

// IT already reaches Settings and the Audit & Security Log, and support work
// regularly needs to answer "what access does this account actually hold?".
// They are admitted to the Staff Portal as observers: the three read-only
// interactions and nothing that changes an account. Adding a role here grants
// look-but-do-not-touch only — every writing action stays with FULL_ACCESS_ROLES.
export const STAFF_PORTAL_OBSERVER_ROLES = ['IT'];

// Roles that must confirm a code sent to their own inbox before the portal
// opens, on top of the password. These three are the ones that reach payroll,
// bank details and the money: a leaked password for any of them is the whole
// system. Adding a role here is the only change needed to extend it — the
// sign-in flow reads this list and nothing else.
//
// Staff and Client are deliberately absent. They hold their own records and
// little else, and a code at every sign-in for an account with nothing to
// reach buys security theatre rather than security.
export const SECOND_FACTOR_ROLES = ['Superadmin', 'Director', 'Account'];

// Every interaction the Staff Portal offers on a portal account. The row
// buttons, the right-click menu and the permission check are all built from
// this one list, so an action can never appear on one surface while missing
// from another. `write: true` means the action changes the account and is
// therefore reserved for FULL_ACCESS_ROLES.
export const STAFF_PORTAL_ACTIONS = [
    { key: 'view', label: 'View', icon: 'fa-eye', variant: 'zq-btn-neutral', write: false, title: 'View account details' },
    { key: 'read', label: 'Read', icon: 'fa-file-lines', variant: 'zq-btn-neutral', write: false, title: 'Read this account’s activity trail' },
    { key: 'access', label: 'Access', icon: 'fa-shield-halved', variant: 'zq-btn-neutral', write: false, title: 'Access rights held by this account' },
    { key: 'edit', label: 'Edit', icon: 'fa-pen', variant: 'zq-btn-info', write: true, title: 'Edit name and role' },
    { key: 'lock', label: 'Lock', icon: 'fa-lock', variant: 'zq-btn-warning', write: true, title: 'Lock this account out of the portal' },
    { key: 'reset', label: 'Reset', icon: 'fa-key', variant: 'zq-btn-warning', write: true, title: 'Require a new password at next sign-in' },
    { key: 'delete', label: 'Delete', icon: 'fa-trash', variant: 'zq-btn-destructive', write: true, title: 'Delete portal access' }
];

// The decision pair on a pending access request. Both write, so both are
// FULL_ACCESS_ROLES-only; they are kept apart from STAFF_PORTAL_ACTIONS
// because they act on a request, not on an existing account.
export const STAFF_PORTAL_REQUEST_ACTIONS = [
    { key: 'accept', label: 'Accept', icon: 'fa-circle-check', variant: 'zq-btn-success', title: 'Approve and apply the requested role' },
    { key: 'reject', label: 'Reject', icon: 'fa-circle-xmark', variant: 'zq-btn-destructive', title: 'Decline the request' }
];