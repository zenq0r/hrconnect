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
