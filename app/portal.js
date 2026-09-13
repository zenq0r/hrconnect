// Everything the portal does once somebody is signed in.
//
// Not imported by app.js. It is fetched with a dynamic import() at the same
// moment the portal's markup is (see ensurePortalCode in app/methods/shell.js),
// so a visitor who never signs in never downloads it — no Firestore collection
// names, no approval workflows, no payroll or billing logic.
//
// Whatever is listed here must not be reached before sign-in completes. That
// is not left to care: tests/portal-code-splitting.test.js walks every path
// that runs before sign-in and fails if one of them touches a name defined in
// these modules.
import { projectMethods } from "./methods/projects.js";
import { clientWorkflowMethods } from "./methods/client-workflow.js";
import { clientIdentityMethods } from "./methods/client-identity.js";
import { clientMethods } from "./methods/clients.js";
import { reportMethods } from "./methods/reports.js";
import { claimMethods } from "./methods/claims.js";
import { billingMethods } from "./methods/billing.js";
import { uploadMethods } from "./methods/uploads.js";
import { adminUserMethods } from "./methods/admin-users.js";
import { websiteContentMethods } from "./methods/website-content.js";
import { contextMenuMethods } from "./methods/context-menu.js";
import { hrMethods } from "./methods/hr.js";
import { realtimeMethods } from "./methods/realtime.js";

export const portalMethods = {
    ...clientIdentityMethods,
    ...projectMethods,
    ...clientWorkflowMethods,
    ...reportMethods,
    ...claimMethods,
    ...billingMethods,
    ...uploadMethods,
    ...adminUserMethods,
    ...clientMethods,
    ...websiteContentMethods,
    ...contextMenuMethods,
    ...hrMethods,
    ...realtimeMethods,
};

// Called once, right after these methods are attached. These used to run in
// mounted(), for every visitor, preparing forms only a signed-in staff member
// ever sees.
export function startPortal(vm) {
    vm.autoCalculatePayroll();
    vm.generateDocNo();
    vm.installUniversalButtonContextMenu();
}
