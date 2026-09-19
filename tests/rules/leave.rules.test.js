// Leave Requests, write by write, against the deployed rules.
const { test, before, after, beforeEach } = require('node:test');
const { start, stop, reset, seed, as, assertFails, assertSucceeds } = require('./harness');

before(start);
after(stop);

const leavePayload = (overrides = {}) => ({
    empNo: 'E-STAFF', empEmail: 'staff@zenqor.com.my', name: 'PIC STAFF', position: 'Executive', dept: 'Ops',
    leaveType: 'Annual', startDate: '2026-09-20', endDate: '2026-09-22', totalDays: 3, reason: 'Family trip',
    status: 'Pending HR', createdByUid: 'u-staff', createdByEmail: 'staff@zenqor.com.my', createdAt: '2026-09-16T00:00:00.000Z',
    ...overrides,
});

beforeEach(async () => {
    await reset();
    await seed({
        'employees/E-STAFF': { empNo: 'E-STAFF', name: 'PIC STAFF', email: 'staff@zenqor.com.my', dept: 'Ops', position: 'Executive' },
        'employees/E-OTHER': { empNo: 'E-OTHER', name: 'OTHER STAFF', email: 'other@zenqor.com.my', dept: 'Ops', position: 'Executive' },
    });
});

test('a staff member files their own leave request', async () => {
    const { db } = as('staff');
    await assertSucceeds(db.doc('leave_requests/L1').set(leavePayload()));
});

test('a staff member cannot file a leave request under a colleague\'s empNo, even with their own email', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('leave_requests/L1').set(leavePayload({ empNo: 'E-OTHER' })));
});

// canSubmitForOthers in leave.js lets HR/Account/Superadmin/Director file a
// request on behalf of any employee, the same way claims/payment_vouchers
// already let them — mirrored here against the rule, not just the client.
test('HR files a leave request on behalf of a staff member', async () => {
    const { db } = as('hr');
    await assertSucceeds(db.doc('leave_requests/L1').set(leavePayload({ createdByUid: 'u-hr' })));
});

// The submitter here (Superadmin) has no employees/{empNo} record of their
// own — a pure portal account, same shape as this app's real seed admin —
// so the get()-based self-ownership check below could never pass for them.
// isFinanceOrHR() must skip that check entirely rather than 500/deny.
test('Superadmin without an employee record of their own can still file leave for an employee', async () => {
    const { db } = as('superadmin');
    await assertSucceeds(db.doc('leave_requests/L1').set(leavePayload({ createdByUid: 'u-superadmin' })));
});

test('a staff member cannot file a leave request claiming to be someone else\'s createdByUid', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('leave_requests/L1').set(leavePayload({ createdByUid: 'u-other' })));
});

test('a new leave request must start Pending HR', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('leave_requests/L1').set(leavePayload({ status: 'Approved' })));
});

test('a staff member edits their own request while it is still pending, but not after', async () => {
    const { db } = as('staff');
    await seed({ 'leave_requests/L1': leavePayload() });
    await assertSucceeds(db.doc('leave_requests/L1').update({ reason: 'Family trip, extended by a day', endDate: '2026-09-23', totalDays: 4, leaveType: 'Annual', startDate: '2026-09-20' }));
    await seed({ 'leave_requests/L1': leavePayload({ status: 'Approved', approvedByUid: 'u-hr', approvedByName: 'HR OFFICER', approvedByRole: 'HR', approvedAt: '2026-09-17T00:00:00.000Z' }) });
    await assertFails(db.doc('leave_requests/L1').update({ reason: 'trying to edit after approval' }));
});

test('a staff member cannot edit a colleague\'s leave request', async () => {
    const { db } = as('staff');
    await seed({ 'leave_requests/L1': leavePayload({ empNo: 'E-OTHER', empEmail: 'other@zenqor.com.my', name: 'OTHER STAFF' }) });
    await assertFails(db.doc('leave_requests/L1').update({ reason: 'tampering' }));
});

// canEditLeaveRequest() grants isFullAccessRole (Superadmin/Director) a
// blanket edit on any still-pending request, not just the correction path
// below — this is that pencil-icon edit, editing someone else's request
// while it is still Pending HR (isLeaveCorrection() covers the separate,
// stamped post-decision correction case instead).
test('Director edits a colleague\'s still-pending leave request', async () => {
    const { db } = as('director');
    await seed({ 'leave_requests/L1': leavePayload({ empNo: 'E-OTHER', empEmail: 'other@zenqor.com.my', name: 'OTHER STAFF' }) });
    await assertSucceeds(db.doc('leave_requests/L1').update({ reason: 'HR adjusted the reason on the employee\'s behalf' }));
});

test('HR approves a pending leave request, stamped as themselves', async () => {
    await seed({ 'leave_requests/L1': leavePayload() });
    const { db } = as('hr');
    await assertFails(db.doc('leave_requests/L1').update({ status: 'Approved', approvedByUid: 'u-someone-else', approvedByName: 'HR OFFICER', approvedByRole: 'HR', approvedAt: '2026-09-17T00:00:00.000Z' }));
    await assertSucceeds(db.doc('leave_requests/L1').update({ status: 'Approved', approvedByUid: 'u-hr', approvedByName: 'HR OFFICER', approvedByRole: 'HR', approvedAt: '2026-09-17T00:00:00.000Z' }));
});

test('HR rejects a pending leave request, and cannot also change its dates in the same write', async () => {
    await seed({ 'leave_requests/L1': leavePayload() });
    const { db } = as('hr');
    await assertFails(db.doc('leave_requests/L1').update({ status: 'Rejected', rejectedByUid: 'u-hr', rejectedByName: 'HR OFFICER', rejectedByRole: 'HR', rejectedAt: '2026-09-17T00:00:00.000Z', startDate: '2026-09-21' }));
    await assertSucceeds(db.doc('leave_requests/L1').update({ status: 'Rejected', rejectedByUid: 'u-hr', rejectedByName: 'HR OFFICER', rejectedByRole: 'HR', rejectedAt: '2026-09-17T00:00:00.000Z' }));
});

test('HR cannot decide a request that is not Pending HR', async () => {
    await seed({ 'leave_requests/L1': leavePayload({ status: 'Approved', approvedByUid: 'u-hr', approvedByName: 'HR OFFICER', approvedByRole: 'HR', approvedAt: '2026-09-17T00:00:00.000Z' }) });
    const { db } = as('hr');
    await assertFails(db.doc('leave_requests/L1').update({ status: 'Rejected', rejectedByUid: 'u-hr', rejectedByName: 'HR OFFICER', rejectedByRole: 'HR', rejectedAt: '2026-09-18T00:00:00.000Z' }));
});

test('Account has no decision power over leave, and reads only its own', async () => {
    await seed({ 'leave_requests/L1': leavePayload() });
    const { db } = as('account');
    await assertFails(db.doc('leave_requests/L1').get());
    await assertFails(db.doc('leave_requests/L1').update({ status: 'Approved', approvedByUid: 'u-account', approvedByName: 'FINANCE', approvedByRole: 'Account', approvedAt: '2026-09-17T00:00:00.000Z' }));
});

test('Director corrects a decided leave request, stamped with who corrected it', async () => {
    await seed({ 'leave_requests/L1': leavePayload({ status: 'Approved', approvedByUid: 'u-hr', approvedByName: 'HR OFFICER', approvedByRole: 'HR', approvedAt: '2026-09-17T00:00:00.000Z' }) });
    const { db } = as('director');
    const stamp = { lastEditedByUid: 'u-director', lastEditedByName: 'DIRECTOR', lastEditedAt: '2026-09-18T00:00:00.000Z' };
    await assertFails(db.doc('leave_requests/L1').update({ endDate: '2026-09-23', totalDays: 4, ...stamp, lastEditedByUid: 'u-someone-else' }));
    await assertFails(db.doc('leave_requests/L1').update({ endDate: '2026-09-23', totalDays: 4, status: 'Rejected', ...stamp }));
    await assertSucceeds(db.doc('leave_requests/L1').update({ endDate: '2026-09-23', totalDays: 4, ...stamp }));
});

test('a staff member reads only their own leave requests', async () => {
    await seed({
        'leave_requests/L1': leavePayload(),
        'leave_requests/L2': leavePayload({ empNo: 'E-OTHER', empEmail: 'other@zenqor.com.my', name: 'OTHER STAFF', createdByUid: 'u-staff2', createdByEmail: 'other@zenqor.com.my' }),
    });
    const { db } = as('staff');
    await assertSucceeds(db.doc('leave_requests/L1').get());
    await assertFails(db.doc('leave_requests/L2').get());
});

test('HR and Admin read every leave request', async () => {
    await seed({ 'leave_requests/L1': leavePayload() });
    await assertSucceeds(as('hr').db.doc('leave_requests/L1').get());
    await assertSucceeds(as('director').db.doc('leave_requests/L1').get());
    await assertSucceeds(as('superadmin').db.doc('leave_requests/L1').get());
});

test('only Superadmin and Director delete a leave request', async () => {
    await seed({ 'leave_requests/L1': leavePayload() });
    await assertFails(as('hr').db.doc('leave_requests/L1').delete());
    await assertSucceeds(as('director').db.doc('leave_requests/L1').delete());
});
