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