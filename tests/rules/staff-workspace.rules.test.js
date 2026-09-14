// The Staff Workspace, write by write, against the deployed rules.
const { test, before, after, beforeEach } = require('node:test');
const { start, stop, reset, seed, as, assertFails, assertSucceeds, SIGNED_IN_AT } = require('./harness');

before(start);
after(stop);

const pendingClaim = (overrides = {}) => ({
    id: 'C1', type: 'Claim', documentType: 'Claim', status: 'Pending HR', name: 'PIC STAFF', empNo: 'E1', empEmail: 'staff@zenqor.com.my',
    amount: 120, category: 'TRAVEL', description: 'GRAB TO CLIENT', receiptNo: 'R-1', createdByUid: 'u-staff', createdByEmail: 'staff@zenqor.com.my',
    createdAt: '2026-09-01T00:00:00.000Z', assignedToUid: '', assignedToName: 'Human Resource Management', assignedToEmail: '', assignedToRole: 'HR',
    ...overrides,
});

beforeEach(async () => {
    await reset();
    await seed({
        'claims/C1': pendingClaim(),
        'claims/C2': pendingClaim({ id: 'C2', status: 'Pending Account', assignedToRole: 'Account' }),
        'claims/C3': pendingClaim({ id: 'C3', status: 'Pending Director', assignedToRole: 'Director' }),
        'employees/E1': { empNo: 'E1', name: 'PIC STAFF', email: 'staff@zenqor.com.my', ic: '900101-01-0001', bankAcc: '111' },
        'employees/E9': { empNo: 'E9', name: 'IT OFFICER', email: 'it@zenqor.com.my', ic: '900101-01-0009', bankAcc: '999' },
    });
});

// ---- Claims -------------------------------------------------------------

test('an employee files a claim for themselves, and not for anyone else', async () => {
    const { db } = as('staff');
    await assertSucceeds(db.doc('claims/N1').set(pendingClaim({ id: 'N1' })));
    await assertFails(db.doc('claims/N2').set(pendingClaim({ id: 'N2', empEmail: 'other@zenqor.com.my' })));
});

test('HR forwards a claim to Finance, changing nothing but the workflow', async () => {
    const { db } = as('hr');
    const forward = {
        status: 'Pending Account', assignedToUid: '', assignedToName: 'Finance Account Management', assignedToEmail: '', assignedToRole: 'Account',
        approvalHistory: [{ role: 'HR', approvedByUid: 'u-hr', approvedAt: '2026-09-13T00:00:00.000Z' }],
    };
    await assertFails(db.doc('claims/C1').update({ ...forward, amount: 999 }));
    // Anything else about the claim is the claimant's, not the approver's.
    await assertFails(db.doc('claims/C1').update({ ...forward, description: 'SOMETHING ELSE' }));
    await assertFails(db.doc('claims/C1').update({ ...forward, empEmail: 'hr@zenqor.com.my' }));
    await assertSucceeds(db.doc('claims/C1').update(forward));
});

test('a rejection is stamped with whoever rejected it', async () => {
    const { db } = as('hr');
    const reject = (uid) => ({ status: 'Rejected', rejectedByUid: uid, rejectedByName: 'HR OFFICER', rejectedByRole: 'HR', rejectedAt: '2026-09-13T00:00:00.000Z' });
    await assertFails(db.doc('claims/C1').update(reject('u-director')));
    await assertSucceeds(db.doc('claims/C1').update(reject('u-hr')));
});

test('Finance forwards to the Director, and the Director approves', async () => {
    await assertSucceeds(as('account').db.doc('claims/C2').update({
        status: 'Pending Director', assignedToUid: '', assignedToName: 'Director', assignedToEmail: '', assignedToRole: 'Director', approvalHistory: [],
    }));
    await assertSucceeds(as('director').db.doc('claims/C3').update({
        status: 'Approved', finalDecision: true, settlementStatus: 'Approved', statusDetail: 'Claim fully approved', approvalPath: 'Director Direct Approval',
        approvalPreviousStatus: 'Pending Director', bypassedReviews: [], assignedToUid: 'u-director', assignedToName: 'DIRECTOR', assignedToEmail: 'director@zenqor.com.my',
        assignedToRole: 'Director', approvedByUid: 'u-director', approvedByName: 'DIRECTOR', approvedByEmail: 'director@zenqor.com.my', approvedByRole: 'Director',
        approvedAt: '2026-09-13T00:00:00.000Z', directorApprovalAttachment: 'https://firebasestorage.googleapis.com/a', directorApprovalAttachmentName: 'a.jpg',
        directorApprovalOriginalBytes: 1000, approvalHistory: [],
    }));
});

test('a Director correction is stamped and never moves the status', async () => {
    const { db } = as('director');
    const stamp = { lastEditedByUid: 'u-director', lastEditedByName: 'DIRECTOR', lastEditedAt: '2026-09-13T00:00:00.000Z' };
    await assertFails(db.doc('claims/C3').update({ amount: 150 }));
    await assertFails(db.doc('claims/C3').update({ amount: 150, status: 'Approved', ...stamp }));
    await assertSucceeds(db.doc('claims/C3').update({ amount: 150, ...stamp }));
});

test('IT staff file and follow their own claims like any other employee', async () => {
    const { db } = as('it');
    const own = pendingClaim({ id: 'IT1', name: 'IT OFFICER', empNo: 'E9', empEmail: 'it@zenqor.com.my', createdByUid: 'u-it', createdByEmail: 'it@zenqor.com.my' });
    await assertSucceeds(db.doc('claims/IT1').set(own));
    await assertSucceeds(db.doc('claims/IT1').get());
    await assertSucceeds(db.collection('claims').where('empEmail', '==', 'it@zenqor.com.my').get());
    await assertFails(db.doc('claims/C1').get());
});

// ---- Second factor ------------------------------------------------------

test('a role that must clear the second factor gets nothing until it has', async () => {
    await assertFails(as('director', { secondFactor: false }).db.doc('employees/E1').get());
    await assertFails(as('account', { secondFactor: false }).db.collection('claims').get());
    // A stamp from an earlier sign-in does not carry over to this one.
    await assertFails(as('director', { secondFactorAt: SIGNED_IN_AT - 3600 }).db.doc('employees/E1').get());
    await assertSucceeds(as('director').db.doc('employees/E1').get());
    // Its own profile stays readable: that is how sign-in learns the role.
    await assertSucceeds(as('director', { secondFactor: false }).db.doc('users/u-director').get());
    // Roles outside the second factor are unaffected.
    await assertSucceeds(as('hr').db.doc('employees/E1').get());
});

// ---- Privacy ------------------------------------------------------------

test('a person\'s notification history is theirs alone', async () => {
    await seed({ 'users/u-director/private/notifications': { log: [{ message: 'Deleted invoice INV-1, RM 5,000.00.' }] } });
    await assertFails(as('staff').db.doc('users/u-director/private/notifications').get());
    await assertSucceeds(as('director').db.doc('users/u-director/private/notifications').get());
    await assertSucceeds(as('staff').db.doc('users/u-staff/private/notifications').set({ log: [] }));
    // And it no longer goes on the profile every staff account can read.
    await assertFails(as('staff').db.doc('users/u-staff').update({ notificationsLog: [{ message: 'x' }] }));
});

test('client conversations are read by the people on that project', async () => {
    await seed({
        'projects/P-1': { clientDirectoryId: 'CUST-1', clientPortalUid: 'u-client', clientEmail: 'buyer@clientco.com', ownerEmail: 'staff@zenqor.com.my', ownerEmpNo: 'E1', projectRef: 'PRJ-1', title: 'LICENCE', status: 'In Progress', activityAssigneeEmails: ['it@zenqor.com.my'] },
        'project_client_updates/U1': { projectId: 'P-1', clientDirectoryId: 'CUST-1', clientPortalUid: 'u-client', senderUid: 'u-client', senderRole: 'Client', message: 'OUR BANK DETAILS ARE...' },
    });
    await assertSucceeds(as('staff').db.doc('project_client_updates/U1').get());
    await assertSucceeds(as('it').db.doc('project_client_updates/U1').get());
    await assertSucceeds(as('director').db.doc('project_client_updates/U1').get());
    await assertFails(as('otherStaff').db.doc('project_client_updates/U1').get());
    // The query the portal runs for a PIC's own projects.
    await assertSucceeds(as('staff').db.collection('project_client_updates').where('projectId', 'in', ['P-1']).get());
    await assertFails(as('otherStaff').db.collection('project_client_updates').get());
});

// ---- Project creation (open to any staff role, per canCreateProject) ------

test('any staff role may create a project, a Client never can', async () => {
    await seed({ 'customers/CUST-1': { clientName: 'CLIENT CO', clientTaskCreatedAt: '2026-09-01T00:00:00.000Z' } });
    const newProject = (overrides = {}) => ({
        projectType: 'DOC', projectRef: 'DOC-2026-000001', title: 'A DOCUMENT PROJECT',
        clientDirectoryId: 'CUST-1', clientPortalUid: 'u-client', clientName: 'CLIENT CO', clientEmail: 'buyer@clientco.com',
        ownerEmpNo: 'E1', ownerName: 'PIC STAFF', ownerEmail: 'staff@zenqor.com.my',
        status: 'Project Planning',
        createdByUid: 'u-staff', createdByEmail: 'staff@zenqor.com.my', updatedByUid: 'u-staff', updatedByEmail: 'staff@zenqor.com.my',
        ...overrides,
    });
    // Staff — not Director/Superadmin — creating a brand-new project.
    await assertSucceeds(as('staff').db.doc('projects/P-new').set(newProject()));
    // A Client account can never create one, regardless of what it sends.
    await assertFails(as('client').db.doc('projects/P-c1').set(newProject({
        createdByUid: 'u-client', createdByEmail: 'buyer@clientco.com', updatedByUid: 'u-client', updatedByEmail: 'buyer@clientco.com',
    })));
});

test('a project reference counter can only ever move forward by exactly 1', async () => {
    const { db } = as('staff');
    // Must start at 1 — no seeding a counter mid-sequence on create.
    await assertFails(db.doc('project_ref_counters/DOC_2026').set({ count: 5 }));
    await assertSucceeds(db.doc('project_ref_counters/DOC_2026').set({ count: 1 }));
    // From 1, only 2 is a legal next write — never a skip, never backward.
    await assertFails(db.doc('project_ref_counters/DOC_2026').set({ count: 4 }));
    await assertFails(db.doc('project_ref_counters/DOC_2026').set({ count: 1 }));
    await assertSucceeds(db.doc('project_ref_counters/DOC_2026').set({ count: 2 }));
    // A Client account has no reason to ever touch this collection.
    await assertFails(as('client').db.doc('project_ref_counters/DOC_2026').set({ count: 3 }));
});

// ---- Trusted devices --------------------------------------------------

test('a staff account reads and revokes only its own trusted device', async () => {
    await seed({
        'trusted_devices/hash-staff-1': { uid: 'u-staff', label: 'Chrome on Windows 10/11', createdAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-10-01T00:00:00.000Z', lastUsedAt: '2026-09-01T00:00:00.000Z', revoked: false },
        'trusted_devices/hash-other-1': { uid: 'u-staff2', label: 'Safari on macOS', createdAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-10-01T00:00:00.000Z', lastUsedAt: '2026-09-01T00:00:00.000Z', revoked: false },
    });
    // Its own — readable. Someone else's, and another staff role's own — neither,
    // even a Director's, since this is a self-service revoke list, not an
    // admin one.
    await assertSucceeds(as('staff').db.doc('trusted_devices/hash-staff-1').get());
    await assertFails(as('staff').db.doc('trusted_devices/hash-other-1').get());
    await assertFails(as('director').db.doc('trusted_devices/hash-staff-1').get());
    // No client-side write ever creates or renews one — /api/verify-login-otp
    // (Admin SDK) is the only path, independent of who is signed in.
    await assertFails(as('staff').db.doc('trusted_devices/hash-new').set({ uid: 'u-staff', label: 'Forged', createdAt: '2026-09-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z', lastUsedAt: '2026-09-01T00:00:00.000Z', revoked: false }));
    await assertFails(as('staff').db.doc('trusted_devices/hash-staff-1').update({ expiresAt: '2099-01-01T00:00:00.000Z' }));
    // Revoke — its own succeeds, someone else's does not.
    await assertFails(as('staff').db.doc('trusted_devices/hash-other-1').delete());
    await assertSucceeds(as('staff').db.doc('trusted_devices/hash-staff-1').delete());
});

// ---- Billing documents ----------------------------------------------------

test('Finance issues a quotation whose totals agree, and only then', async () => {
    const { db } = as('account');
    const doc = (sst) => ({ type: 'Quotation', status: 'Open', subtotal: 1000, discount: 100, sst, amount: 900 + sst, raw: { customerId: 'CUST-1', items: [{ qty: 1, price: 1000 }] } });
    await assertFails(db.doc('docs/Q9').set(doc(10)));
    await assertSucceeds(db.doc('docs/Q9').set(doc(80)));
});

test('storage follows the same second factor', async () => {
    await assertFails(as('director', { secondFactor: false }).storage.ref('client_documents/CUST-1/ssm.pdf').getMetadata());
    await assertFails(as('account', { secondFactor: false }).storage.ref('client_documents/CUST-1/new.pdf').put(Buffer.from('%PDF'), { contentType: 'application/pdf' }));
    await assertSucceeds(as('account').storage.ref('client_documents/CUST-1/new.pdf').put(Buffer.from('%PDF'), { contentType: 'application/pdf' }));
});

test('why an account was locked is for administrators and that person', async () => {
    await seed({ 'access_locks/u-staff': { reason: 'UNDER INVESTIGATION', lockedAt: '2026-09-13T00:00:00.000Z' } });
    await assertSucceeds(as('director').db.doc('access_locks/u-staff').get());
    await assertSucceeds(as('staff').db.doc('access_locks/u-staff').get());
    await assertFails(as('otherStaff').db.doc('access_locks/u-staff').get());
    await assertFails(as('hr').db.collection('access_locks').get());
    // Written by the server alone.
    await assertFails(as('director').db.doc('access_locks/u-staff').set({ reason: 'x' }));
});
