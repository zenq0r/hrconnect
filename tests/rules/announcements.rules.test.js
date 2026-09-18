// Announcements — a company-wide notice board. Director/Superadmin/HR post
// and archive; every other internal role reads Active notices only; Client
// accounts never reach the collection at all.
const { test, before, after, beforeEach } = require('node:test');
const { start, stop, reset, seed, as, assertFails, assertSucceeds } = require('./harness');

before(start);
after(stop);

const active = (overrides = {}) => ({
    id: 'A1', title: 'OFFICE CLOSED FRIDAY', message: 'THE OFFICE IS CLOSED THIS FRIDAY FOR MAINTENANCE.',
    priority: 'Normal', status: 'Active',
    createdByUid: 'u-hr', createdByName: 'HR OFFICER', createdByEmail: 'hr@zenqor.com.my', createdAt: '2026-09-01T00:00:00.000Z',
    lastEditedByUid: 'u-hr', lastEditedByName: 'HR OFFICER', lastEditedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
});

beforeEach(async () => {
    await reset();
    await seed({
        'announcements/A1': active(),
        'announcements/A2': active({ id: 'A2', title: 'ARCHIVED NOTICE', status: 'Archived' }),
    });
});

test('any internal staff role reads an Active announcement; a Client never can', async () => {
    for (const name of ['superadmin', 'director', 'hr', 'account', 'it', 'staff']) {
        await assertSucceeds(as(name).db.doc('announcements/A1').get());
    }
    await assertFails(as('client').db.doc('announcements/A1').get());
});

test('only Director, Superadmin and HR read an Archived announcement', async () => {
    for (const name of ['superadmin', 'director', 'hr']) {
        await assertSucceeds(as(name).db.doc('announcements/A2').get());
    }
    for (const name of ['account', 'it', 'staff']) {
        await assertFails(as(name).db.doc('announcements/A2').get());
    }
});

test('HR posts an announcement stamped as themselves; Staff cannot post one at all', async () => {
    await assertSucceeds(as('hr').db.doc('announcements/N1').set(active({ id: 'N1' })));
    await assertFails(as('staff').db.doc('announcements/N2').set(active({
        id: 'N2', createdByUid: 'u-staff', createdByName: 'PIC STAFF', createdByEmail: 'staff@zenqor.com.my',
        lastEditedByUid: 'u-staff', lastEditedByName: 'PIC STAFF',
    })));
});

test('a posted announcement cannot be stamped as someone else, or posted without a title or message', async () => {
    await assertFails(as('hr').db.doc('announcements/N3').set(active({ id: 'N3', createdByUid: 'u-director' })));
    await assertFails(as('hr').db.doc('announcements/N4').set(active({ id: 'N4', title: '' })));
    await assertFails(as('hr').db.doc('announcements/N5').set(active({ id: 'N5', message: '' })));
});

test('HR archives and restores; Staff cannot change status at all', async () => {
    await assertSucceeds(as('hr').db.doc('announcements/A1').set(active({ status: 'Archived', lastEditedByUid: 'u-hr' })));
    await assertSucceeds(as('director').db.doc('announcements/A2').set(active({ id: 'A2', status: 'Active', lastEditedByUid: 'u-director' })));
    await assertFails(as('staff').db.doc('announcements/A1').set(active({ status: 'Archived', lastEditedByUid: 'u-staff' })));
});

test('only Superadmin and Director delete an announcement', async () => {
    await assertFails(as('hr').db.doc('announcements/A1').delete());
    await assertFails(as('staff').db.doc('announcements/A1').delete());
    await assertSucceeds(as('director').db.doc('announcements/A1').delete());
});
