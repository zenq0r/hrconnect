// Permission gates: what the signed-in role may open, edit, delete or approve,
// plus the portal access-request queue built on the same rules.
import { SUPPORT_EMAIL } from "../config.js";
import { RBAC_ROLES, FULL_ACCESS_ROLES, STAFF_PORTAL_OBSERVER_ROLES } from "../constants/rbac.js";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT } from "../constants/password-policy.js";
export const accessComputed = {
        // Shown next to every field that sets a password, so the rule is read
        // before it is enforced rather than after.
        passwordPolicy() { return PASSWORD_POLICY_TEXT; },
        passwordMinLength() { return PASSWORD_MIN_LENGTH; },
        canManageSensitiveData() { return ['Superadmin', 'Director', 'HR'].includes(this.userProfile.role); },
        // Identity/banking numbers (IC/Passport, Bank Account, EPF/SOCSO) may be
        // entered ONCE when an employee record is first created by anyone with HR
        // Employees access (canManageEmployees), but once that record already
        // exists, changing these specific fields is restricted to Superadmin/
        // Director only — narrower than canManageSensitiveData above, which still
        // includes HR for everything else on the employee record.
        canEditLockedIdentityFields() { return ['Superadmin', 'Director'].includes(this.userProfile.role); },
        canManageEmployees() { return this.hasModulePermission('hr-employees', 'edit'); },
        // Every staff role can open Attendance/Duty Roster to clock themselves
        // in or view their own roster — that visibility comes from RBAC_ROLES,
        // not from these two. These gate the second, narrower ability: correcting
        // someone else's clock event, or building/publishing the week's shifts.
        canCorrectAttendance() { return ['Director', 'Superadmin', 'HR'].includes(this.userProfile.role); },
        canManageDutyRoster() { return ['Director', 'Superadmin', 'HR'].includes(this.userProfile.role); },
        // Every internal role reads Active announcements — that visibility comes
        // from RBAC_ROLES, not this. This gates posting/editing/archiving one,
        // mirroring canManageDutyRoster's pair exactly (same trio in
        // firestore.rules' isAdminOrHR()).
        canManageAnnouncements() { return ['Director', 'Superadmin', 'HR'].includes(this.userProfile.role); },
        canManageClients() { return this.hasModulePermission('client-directory', 'edit'); },
        // Was Director-only. Superadmin now holds it too: an account that can
        // delete a Client Task could not create one, which is not a coherent
        // boundary for a role meant to reach everything.
        canCreateClientTask() { return this.isFullAccessRole; },
        canManageDocuments() { return this.hasModulePermission('doc-generator', 'edit'); },
        // Clients may upload to their OWN client_documents folder (but not the
        // doc-generator/billing tools canManageDocuments otherwise gates) — the
        // Firestore/Storage rules independently re-verify clientDirectoryId ownership,
        // this is just the UI-level show/hide for the upload button.
        canUploadClientDocuments() { return this.canManageDocuments || this.userProfile.role === 'Client'; },
        // Must mirror the client_documents read rule. Staff sit outside it: they run
        // projects but are not trusted with the client's file repository. Without
        // this check the panel subscribes anyway and paints a red permission error
        // on every project a Staff PIC or activity assignee opens.
        canViewClientDocuments() { return ['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Client'].includes(this.userProfile.role); },
        canManagePayroll() { return this.hasModulePermission('payslip-generator', 'edit'); },
        canDeleteEmployees() { return this.hasModulePermission('hr-employees', 'delete'); },
        canDeleteClients() { return this.hasModulePermission('client-directory', 'delete'); },
        // Finance is stored as the Account role. It may delete only official
        // billing documents; all other delete capabilities remain unchanged.
        canDeleteBillingDocuments() { return ['Superadmin', 'Director', 'Account'].includes(this.userProfile.role); },
        canDeletePayroll() { return this.hasModulePermission('payslip-generator', 'delete'); },
        // Superadmin and Director hold every module their role lists, with edit
        // and delete on each, and no per-user override may subtract from that.
        // Anything narrower would let an admin lock another admin out of a page.
        isFullAccessRole() { return FULL_ACCESS_ROLES.includes(this.userProfile.role); },
        canDelete() { return this.isFullAccessRole; },
        canManageRBAC() { return this.isFullAccessRole; },
        // Staff Portal. Managing it is the full-access pair and nobody else:
        // every interaction that writes an account — Edit, Lock, Reset, Delete,
        // Accept, Reject — is gated on this. Observing it additionally admits
        // STAFF_PORTAL_OBSERVER_ROLES, who get View, Read and Access only.
        canManageStaffPortal() { return this.isFullAccessRole; },
        canObserveStaffPortal() { return this.isFullAccessRole || STAFF_PORTAL_OBSERVER_ROLES.includes(this.userProfile.role); },
        // A locked account keeps its record and its role — it simply may not
        // sign in or write anything until an administrator unlocks it. This is
        // the viewer's own state, used to end a session the moment it is locked.
        isCurrentAccountLocked() {
            const currentUser = this.users.find(user => user.id === this.userProfile.uid);
            return this.isAccountLocked(currentUser);
        },
        sortedAccessRequests() {
            return [...this.accessRequests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        },
        pendingAccessRequests() {
            return this.sortedAccessRequests.filter(request => (request.status || 'Pending') === 'Pending');
        },
        decidedAccessRequests() {
            return this.sortedAccessRequests.filter(request => (request.status || 'Pending') !== 'Pending');
        },
        myAccessRequests() {
            return this.sortedAccessRequests.filter(request => request.requesterUid === this.userProfile.uid);
        },
        // One open request at a time per person. A second one would leave two
        // Accept buttons pointing at the same account with different roles.
        myPendingAccessRequest() {
            return this.myAccessRequests.find(request => (request.status || 'Pending') === 'Pending') || null;
        },
        // Roles a staff member may ask to be moved to: every staff role except
        // the one they already hold. Client is not requestable — a Client
        // account belongs to a customer record, not to an internal request.
        requestableRoles() {
            return Object.keys(RBAC_ROLES).filter(role => role !== 'Client' && role !== this.userProfile.role);
        },
        // The Profile page offers the request form to staff who are not already
        // full access. Superadmin and Director would be asking themselves.
        canRequestAccessChange() {
            return !this.isFullAccessRole && this.userProfile.role !== 'Client' && Boolean(this.userProfile.uid);
        },
        canManageCompanySettings() { return ['Director', 'Superadmin', 'IT'].includes(this.userProfile.role); },
        canManageProjects() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Any staff role (never Client) may create a new project — every creation
        // is still audited (saveProject calls logAudit unconditionally). This is
        // deliberately broader than canManageProjects, which stays Director/
        // Superadmin-only for editing, reassigning or deleting an EXISTING one.
        canCreateProject() { return ['Staff', 'HR', 'Account', 'IT', 'Director', 'Superadmin'].includes(this.userProfile.role); },
        // Must mirror the customers subscription condition in loadPortalData(), or
        // any gate built on this.customers silently evaluates against an empty list
        // for Staff/IT — who deliberately cannot read the Client Directory.
        canReadClientDirectory() { return this.hasAccess('client-directory') || this.hasAccess('doc-generator'); },
        // Exposed to the template so the support-email fallback is not a second
        // hardcoded copy of the address in the markup.
        supportEmail() { return SUPPORT_EMAIL; },
        // Clicking a Client Task only filters the Project Activities board to that
        // client — it reveals nothing the board would not already show, because
        // filteredProjects still scopes a non-manager to their own PIC and assigned
        // projects. So the gate is "can you open Project Activities at all", not
        // "are you a Director": a PIC who can see the Client Task page must be able
        // to open it, which is the whole point of the page.
        canOpenClientTaskBoard() { return this.hasAccess('project-activities'); },
        canBackupDatabase() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Closing a period writes a company-wide financial summary, so it sits with
        // the other whole-company actions rather than with per-module edit rights.
        canCloseAccountingPeriod() { return ['Director', 'Superadmin'].includes(this.userProfile.role); },
        // Header staff-roster button: every employee regardless of online status,
        // online staff surfaced first (then alphabetical) so Director/Superadmin
        // gets an at-a-glance headcount-style view, not a presence filter.
        companyTinState() { return this.tinFormatState(this.company.tin); },
        // Every email that a directory record vouches for: the HR employee
        // directory plus every authorized address on a client company record
        // (the primary contact and any additionalClientEmails). Built once per
        // data change rather than rescanned per row - isPresenceAnchored() is
        // called from list sorting and from every rendered row, so a linear
        // scan there would be quadratic on a large staff list.
        presenceAnchorEmails() {
            const anchored = new Set();
            this.employees.forEach(emp => {
                const email = String(emp.email || '').trim().toLowerCase();
                if (email) anchored.add(email);
            });
            this.customers.forEach(customer => {
                [customer.clientEmail, ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])]
                    .map(address => String(address || '').trim().toLowerCase())
                    .filter(Boolean)
                    .forEach(address => anchored.add(address));
            });
            return anchored;
        },
        canViewStaffDirectory() { return this.canManageRBAC; }
};