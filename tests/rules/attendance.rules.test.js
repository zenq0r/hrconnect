// Attendance and Duty Roster, write by write, against the deployed rules.
const { test, before, after, beforeEach } = require('node:test');
const { serverTimestamp } = require('firebase/firestore');
const { start, stop, reset, seed, as, assertFails, assertSucceeds } = require('./harness');

before(start);
after(stop);

const clockInPayload = (overrides = {}) => ({
    empNo: 'E-STAFF', empEmail: 'staff@zenqor.com.my', name: 'PIC STAFF', position: 'Executive', dept: 'Ops',
    date: '2026-09-16', clockInAt: serverTimestamp(), clockOutAt: null, status: 'Clocked In',
    createdByUid: 'u-staff', createdAt: '2026-09-16T00:00:00.000Z',
    ...overrides,
});

beforeEach(async () => {
    await reset();
    await seed({
        'employees/E-STAFF': { empNo: 'E-STAFF', name: 'PIC STAFF', email: 'staff@zenqor.com.my', dept: 'Ops', position: 'Executive' },
        'employees/E-OTHER': { empNo: 'E-OTHER', name: 'OTHER STAFF', email: 'other@zenqor.com.my', dept: 'Ops', position: 'Executive' },
    });
});

// ---- Attendance -----------------------------------------------------------

test('a staff member clocks themselves in with a server-assigned time', async () => {
    const { db } = as('staff');
    await assertSucceeds(db.doc('attendance/E-STAFF_2026-09-16').set(clockInPayload()));
});

test('a staff member cannot clock in under a colleague\'s empNo, even with their own email', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('attendance/E-OTHER_2026-09-16').set(clockInPayload({ empNo: 'E-OTHER' })));
});

test('a forged clock-in time is refused — only the serverTimestamp() sentinel is accepted', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').set(clockInPayload({ clockInAt: new Date('2026-09-16T01:00:00.000Z') })));
});

test('a second clock-in the same day is refused — the record already exists', async () => {
    const { db } = as('staff');
    await assertSucceeds(db.doc('attendance/E-STAFF_2026-09-16').set(clockInPayload()));
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').set(clockInPayload()));
});

test('clocking out only succeeds from Clocked In, and only touches clockOutAt/status', async () => {
    const { db } = as('staff');
    await seed({ 'attendance/E-STAFF_2026-09-16': { ...clockInPayload(), clockInAt: new Date('2026-09-16T00:30:00.000Z') } });
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: new Date('2026-09-16T09:00:00.000Z'), status: 'Clocked Out', name: 'SOMEONE ELSE' }));
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: new Date('2026-09-16T09:00:00.000Z') }));
    await assertSucceeds(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: serverTimestamp(), status: 'Clocked Out' }));
});

test('a staff member cannot clock out twice', async () => {
    const { db } = as('staff');
    await seed({ 'attendance/E-STAFF_2026-09-16': { ...clockInPayload(), clockInAt: new Date('2026-09-16T00:30:00.000Z'), clockOutAt: new Date('2026-09-16T09:00:00.000Z'), status: 'Clocked Out' } });
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: serverTimestamp(), status: 'Clocked Out' }));
});

test('HR corrects a record, stamped with who corrected it', async () => {
    await seed({ 'attendance/E-STAFF_2026-09-16': { ...clockInPayload(), clockInAt: new Date('2026-09-16T00:30:00.000Z') } });
    const { db } = as('hr');
    const stamp = { lastEditedByUid: 'u-hr', lastEditedByName: 'HR OFFICER', lastEditedAt: '2026-09-16T10:00:00.000Z', correctionNote: 'Forgot to clock out; confirmed with employee.' };
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: new Date('2026-09-16T09:00:00.000Z'), status: 'Clocked Out', ...stamp, lastEditedByUid: 'u-someone-else' }));
    await assertSucceeds(db.doc('attendance/E-STAFF_2026-09-16').update({ clockOutAt: new Date('2026-09-16T09:00:00.000Z'), status: 'Clocked Out', ...stamp }));
});

test('a staff member cannot correct their own or anyone else\'s record', async () => {
    await seed({ 'attendance/E-STAFF_2026-09-16': { ...clockInPayload(), clockInAt: new Date('2026-09-16T00:30:00.000Z') } });
    const { db } = as('staff');
    await assertFails(db.doc('attendance/E-STAFF_2026-09-16').update({
        clockOutAt: new Date('2026-09-16T09:00:00.000Z'), status: 'Clocked Out',
        lastEditedByUid: 'u-staff', lastEditedByName: 'PIC STAFF', lastEditedAt: '2026-09-16T10:00:00.000Z', correctionNote: 'self-correction attempt',
    }));
});

test('a staff member reads only their own attendance record, never a colleague\'s', async () => {
    await seed({
        'attendance/E-STAFF_2026-09-16': clockInPayload(),
        'attendance/E-OTHER_2026-09-16': clockInPayload({ empNo: 'E-OTHER', empEmail: 'other@zenqor.com.my', name: 'OTHER STAFF' }),
    });
    const { db } = as('staff');
    await assertSucceeds(db.doc('attendance/E-STAFF_2026-09-16').get());
    await assertFails(db.doc('attendance/E-OTHER_2026-09-16').get());
});

test('HR, Account and Admin read every attendance record', async () => {
    await seed({ 'attendance/E-STAFF_2026-09-16': clockInPayload() });
    await assertSucceeds(as('hr').db.doc('attendance/E-STAFF_2026-09-16').get());
    await assertSucceeds(as('account').db.doc('attendance/E-STAFF_2026-09-16').get());
    await assertSucceeds(as('director').db.doc('attendance/E-STAFF_2026-09-16').get());
});

// ---- Duty Roster ------------------------------------------------------------

const draftWeek = (overrides = {}) => ({
    weekStartDate: '2026-09-14', status: 'Draft',
    shifts: [{ shiftId: '2026-09-14-pagi', date: '2026-09-14', label: 'Pagi', startTime: '08:00', endTime: '17:00', assignedEmpNos: [], assignedNames: [] }],
    createdByUid: 'u-hr', createdByName: 'HR OFFICER', createdAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
});

test('HR builds a duty roster week', async () => {
    const { db } = as('hr');
    await assertSucceeds(db.doc('duty_roster/2026-09-14').set(draftWeek()));
});

test('a staff member cannot create or edit a duty roster week', async () => {
    const { db } = as('staff');
    await assertFails(db.doc('duty_roster/2026-09-14').set(draftWeek()));
    await seed({ 'duty_roster/2026-09-14': draftWeek() });
    await assertFails(db.doc('duty_roster/2026-09-14').update({ status: 'Published' }));
});

test('a Draft week is invisible to Staff; a Published week is read-only for them', async () => {
    await seed({ 'duty_roster/2026-09-14': draftWeek() });
    const { db } = as('staff');
    await assertFails(db.doc('duty_roster/2026-09-14').get());
    await seed({ 'duty_roster/2026-09-14': draftWeek({ status: 'Published' }) });
    await assertSucceeds(db.doc('duty_roster/2026-09-14').get());
    await assertFails(db.doc('duty_roster/2026-09-14').update({ status: 'Draft' }));
});

test('HR and Admin read a Draft week; publishing it opens it to everyone else', async () => {
    await seed({ 'duty_roster/2026-09-14': draftWeek() });
    await assertSucceeds(as('hr').db.doc('duty_roster/2026-09-14').get());
    await assertSucceeds(as('director').db.doc('duty_roster/2026-09-14').get());
    await assertSucceeds(as('hr').db.doc('duty_roster/2026-09-14').update({ status: 'Published', publishedAt: '2026-09-12T00:00:00.000Z', publishedByUid: 'u-hr', publishedByName: 'HR OFFICER' }));
});
