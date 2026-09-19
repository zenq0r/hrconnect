// Announcements — a company-wide notice board. Director/Superadmin/HR post
// and archive; every other internal role reads Active notices only; Client
// accounts never reach the collection at all.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
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

// A single doc get() and a collection list() are different operations to
// Cloud Firestore's rule engine — a get() on one Active doc passing does not
// prove a whole unfiltered list() is safe, and Firestore denies the list
// outright rather than filtering it per document. realtime.js's
// announcementsSource used to be exactly that unfiltered collection()
// listener for Staff/IT/Account, so their real live subscription — a list()
// — was refused end to end even though the get() tests above passed.
// Confirmed live before the fix: a real Staff sign-in got "Missing or
// insufficient permissions" reproducibly. This exercises the actual list()
// shape the fix narrows with where('status', '==', 'Active').
test('Staff LISTS Active announcements the same way the live listener does — a bare, unfiltered list is refused', async () => {
    const { db } = as('staff');
    await assertFails(db.collection('announcements').get());
    const snapshot = await assertSucceeds(db.collection('announcements').where('status', '==', 'Active').get());
    assert.strictEqual(snapshot.size, 1);
    assert.strictEqual(snapshot.docs[0].id, 'A1');
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

// ---- attachments (Firestore metadata field) -------------------------------

test('attachments must be a short list, but the field is otherwise optional', async () => {
    await assertSucceeds(as('hr').db.doc('announcements/N6').set(active({ id: 'N6' })));
    await assertSucceeds(as('hr').db.doc('announcements/N7').set(active({ id: 'N7', attachments: [{ name: 'poster.png', storagePath: 'x' }] })));
    const tooMany = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.png` }));
    await assertFails(as('hr').db.doc('announcements/N8').set(active({ id: 'N8', attachments: tooMany })));
    await assertFails(as('hr').db.doc('announcements/N9').set(active({ id: 'N9', attachments: 'not-a-list' })));
});

// ---- announcement_attachments (Storage bytes) ------------------------------

test('any internal staff role reads an attachment; a Client never can', async () => {
    for (const name of ['superadmin', 'director', 'hr', 'account', 'it', 'staff']) {
        await assertSucceeds(as(name).storage.ref('announcement_attachments/u-hr/poster.png').getMetadata().catch(err => {
            // Object does not exist in the Storage emulator — a NOT_FOUND after
            // the rules already let the read through is a pass for this check.
            if (err?.code === 'storage/object-not-found') return;
            throw err;
        }));
    }
    await assertFails(as('client').storage.ref('announcement_attachments/u-hr/poster.png').getMetadata());
});

test('HR uploads an allowed type within its size cap; an oversized or disallowed file is refused', async () => {
    await assertSucceeds(as('hr').storage.ref('announcement_attachments/u-hr/poster.png')
        .put(Buffer.from([0x89, 0x50, 0x4E, 0x47]), { contentType: 'image/png' }));
    await assertFails(as('hr').storage.ref('announcement_attachments/u-hr/huge.png')
        .put(Buffer.alloc(11 * 1024 * 1024), { contentType: 'image/png' }));
    await assertFails(as('hr').storage.ref('announcement_attachments/u-hr/script.exe')
        .put(Buffer.from('MZ'), { contentType: 'application/x-msdownload' }));
});

test('only Director, Superadmin and HR upload an attachment, and only into their own uid folder', async () => {
    await assertFails(as('staff').storage.ref('announcement_attachments/u-staff/photo.jpg')
        .put(Buffer.from([0xFF, 0xD8, 0xFF]), { contentType: 'image/jpeg' }));
    await assertFails(as('hr').storage.ref('announcement_attachments/u-director/photo.jpg')
        .put(Buffer.from([0xFF, 0xD8, 0xFF]), { contentType: 'image/jpeg' }));
});

// ---- expiresAt (auto-archive) ---------------------------------------------

test('expiresAt is optional, but only ever a short string', async () => {
    await assertSucceeds(as('hr').db.doc('announcements/N10').set(active({ id: 'N10' })));
    await assertSucceeds(as('hr').db.doc('announcements/N11').set(active({ id: 'N11', expiresAt: '2026-12-31' })));
    await assertFails(as('hr').db.doc('announcements/N12').set(active({ id: 'N12', expiresAt: 20261231 })));
    await assertFails(as('hr').db.doc('announcements/N13').set(active({ id: 'N13', expiresAt: '2026-12-31T00:00:00.000Z-too-long' })));
});

test('auto-archiving a past-due notice is an ordinary HR/Director/Superadmin archive, nothing new', async () => {
    await seed({ 'announcements/A3': active({ id: 'A3', title: 'EXPIRED NOTICE', expiresAt: '2020-01-01' }) });
    // This is exactly what autoArchiveExpiredAnnouncements() sends: the
    // signed-in manager stamps themselves as lastEditedByUid on an ordinary
    // status: 'Active' -> 'Archived' write, same shape as a manual Archive.
    await assertSucceeds(as('hr').db.doc('announcements/A3').set(active({
        id: 'A3', title: 'EXPIRED NOTICE', expiresAt: '2020-01-01', status: 'Archived', lastEditedByUid: 'u-hr',
    })));
    // Staff can never perform that write, expired or not.
    await assertFails(as('staff').db.doc('announcements/A3').set(active({
        id: 'A3', title: 'EXPIRED NOTICE', expiresAt: '2020-01-01', status: 'Archived', lastEditedByUid: 'u-staff',
    })));
});
