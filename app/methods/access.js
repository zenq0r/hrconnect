// Role naming and the two module-level permission checks every screen calls.
import { RBAC_ROLES } from "../constants/rbac.js";
export const accessMethods = {
        // Short, standard role names — the kind any basic company HR system
        // uses (HR Admin, Finance, IT, Staff, Client) — rather than each
        // role's full internal department title. One map feeds every place a
        // role name is shown: this dropdown, the Staff Portal roster, audit
        // log lines, notifications and account-creation emails.
        getRoleDisplayName(code) {
            const roles = {
                'Director': 'Director',
                'Superadmin': 'Super Admin',
                'HR': 'HR Admin',
                'Account': 'Finance & Account',
                'IT': 'IT',
                'Staff': 'Staff',
                'Client': 'Client'
            };
            return roles[code] || code;
        },

        hasAccess(moduleName) {
            // Quotation and Invoice are dedicated workspaces backed by the
            // existing document permission. They intentionally do not create
            // an additional RBAC surface or loosen document access.
            const permissionModule = {
                'document-quotations': 'doc-generator',
                'document-invoices': 'doc-generator'
            }[moduleName] || moduleName;
            const allowedModules = RBAC_ROLES[this.userProfile.role] || ['dashboard'];
            return allowedModules.includes(permissionModule);
        },
        // Per-module permission derived from the role alone. 'edit' follows page
        // visibility; 'delete' is Superadmin/Director only, except Finance may
        // delete billing documents and IT may delete website content.
        hasModulePermission(moduleName, action) {
            // website-content grants IT full edit+delete (firestore.rules' isContentAdmin()
            // covers IT for these public-site collections too), unlike every other module
            // where 'delete' defaults to Superadmin/Director only.
            if (action === 'delete' && moduleName === 'website-content') return this.hasAccess(moduleName);
            if (action === 'delete' && moduleName === 'doc-generator') return ['Superadmin', 'Director', 'Account'].includes(this.userProfile.role);
            if (action === 'delete') return ['Superadmin', 'Director'].includes(this.userProfile.role);
            return this.hasAccess(moduleName);
        }
};