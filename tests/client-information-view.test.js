const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, readRaw, methodSource } = require('./helpers/sources');

// The Client Information drawer used to show a curated subset of the
// Client Registration record (openClientView dropped BRN/TIN, the
// additional-authorized-emails list, and every createdAt/updatedAt/by
// field on the floor) inside one undivided block. It is now read-only
// straight from the record, reorganized into the sections requested:
// Client Summary, Company Profile, Primary Contact, Additional Authorized
// Contacts, Registered Address, Related Records, Internal Information,
// Client Activity.

function buildClientMethods() {
    const obj = new Function(`return { ${methodSource('splitClientSSM', 'openClientView', 'clientDocHistory', 'clientRelatedRecordCounts', 'clientRecentActivity', 'formatDateTime')} }`)();
    obj.clientView = { show: false, client: {} };
    return obj;
}

test('openClientView copies every Client Registration field through untouched — nothing dropped, nothing merged', () => {
    const obj = buildClientMethods();
    obj.canViewClientDocuments = false; // skip the client_documents subscription this test doesn't need
    const record = {
        id: 'CUST-1', clientId: 'ZCT-029271-D', clientName: 'ACME SDN BHD', clientSSM: '200901029271 (872376-W)',
        clientBrnNew: '200901029271', clientBrnOld: '872376-W', clientTin: 'C20880050010',
        clientEmail: 'owner@acme.test', additionalClientEmails: ['finance@acme.test', 'admin@acme.test'],
        clientNotes: 'VIP account — always confirm PO before invoicing.',
        createdAt: '2026-01-05T02:00:00.000Z', createdByName: 'Ain Superadmin',
        updatedAt: '2026-09-10T04:00:00.000Z', updatedByName: 'Danish HR'
    };
    obj.openClientView(record);
    const c = obj.clientView.client;
    assert.equal(c.clientBrnNew, '200901029271');
    assert.equal(c.clientBrnOld, '872376-W');
    assert.equal(c.clientTin, 'C20880050010');
    assert.deepEqual(c.additionalClientEmails, ['finance@acme.test', 'admin@acme.test']);
    assert.equal(c.clientEmail, 'owner@acme.test', 'Primary Contact email must stay itself, never absorb the additional list');
    assert.equal(c.createdByName, 'Ain Superadmin');
    assert.equal(c.updatedByName, 'Danish HR');
    assert.equal(c.createdAt, '2026-01-05T02:00:00.000Z');
    assert.equal(c.updatedAt, '2026-09-10T04:00:00.000Z');
});

test('openClientView keeps clientTaskCreatedAt, so a Related Records project tile does not wrongly report the client as unregistered', () => {
    // viewClientBoard() (reused as-is for the new Related Records tiles) gates
    // on cust.clientTaskCreatedAt — omitting it here would make every project
    // click show "Register this client in Client Task" even for a client that
    // already has one.
    const obj = buildClientMethods();
    obj.canViewClientDocuments = false;
    obj.openClientView({ id: 'CUST-1', clientName: 'ACME SDN BHD', clientTaskCreatedAt: '2026-01-01T00:00:00.000Z' });
    assert.equal(obj.clientView.client.clientTaskCreatedAt, '2026-01-01T00:00:00.000Z');
});

test('openClientView splits a legacy combined clientSSM into BRN new/old only when the record predates those own fields', () => {
    const obj = buildClientMethods();
    obj.canViewClientDocuments = false;
    obj.openClientView({ id: 'CUST-2', clientName: 'LEGACY SDN BHD', clientSSM: '199301012242 (266980-X)' });
    assert.equal(obj.clientView.client.clientBrnNew, '199301012242');
    assert.equal(obj.clientView.client.clientBrnOld, '266980-X');
});

test('clientRelatedRecordCounts tallies projects and billing documents independently, never double-counting or dropping a category', () => {
    const obj = buildClientMethods();
    obj.projects = [
        { id: 'P1', clientDirectoryId: 'CUST-1', status: 'In Progress' },
        { id: 'P2', clientDirectoryId: 'CUST-1', status: 'Completed & Done' },
        { id: 'P3', clientDirectoryId: 'CUST-2', status: 'In Progress' } // a different client — must not leak in
    ];
    obj.docHistory = [
        { id: '1', type: 'Quotation', status: 'Accepted', date: '2026-01-01', raw: { customerId: 'CUST-1' } },
        { id: '2', type: 'Invoice', status: 'Unpaid', date: '2026-02-01', raw: { customerId: 'CUST-1' } },
        { id: '3', type: 'Invoice', status: 'Paid', date: '2026-03-01', raw: { customerId: 'CUST-1' } },
        { id: '4', type: 'Invoice', status: 'Partial', date: '2026-04-01', raw: { customerId: 'CUST-1' } },
        { id: '5', type: 'Invoice', status: 'Paid', date: '2026-05-01', raw: { customerId: 'CUST-2' } } // a different client
    ];
    const counts = obj.clientRelatedRecordCounts({ id: 'CUST-1' });
    assert.deepEqual(counts, {
        totalProjects: 2, activeProjects: 1, completedProjects: 1,
        totalQuotations: 1, totalInvoices: 3, unpaidInvoices: 2, paidInvoices: 1
    });
});

test('clientRecentActivity builds a dated feed from project/document lifecycle timestamps, newest first, capped at 8', () => {
    const obj = buildClientMethods();
    obj.projects = [{ id: 'P1', clientDirectoryId: 'CUST-1', projectRef: 'DOC-2026-000001', createdAt: '2026-01-01T00:00:00.000Z' }];
    obj.docHistory = [{
        id: 'legacy-non-numeric-id', createdAt: '2026-01-15T00:00:00.000Z', type: 'Invoice', docNo: 'INV-2026-001', status: 'Paid', date: '2026-02-01',
        raw: { customerId: 'CUST-1' },
        invoiceSentAt: '2026-02-02T00:00:00.000Z',
        paymentProofAt: '2026-02-03T00:00:00.000Z',
        paymentProofReviewedAt: '2026-02-04T00:00:00.000Z'
    }];
    const events = obj.clientRecentActivity({ id: 'CUST-1', updatedAt: '2026-02-05T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' });
    // Newest first: client info update > payment verified > proof submitted > invoice sent > invoice/project created.
    assert.ok(events.length >= 5);
    assert.match(events[0].text, /Client information updated/);
    assert.match(events[1].text, /Payment verified/);
    assert.match(events[2].text, /Payment proof submitted/);
    assert.match(events[3].text, /Invoice sent to client/);
    for (let i = 1; i < events.length; i++) assert.ok(events[i - 1].at >= events[i].at, 'events must be sorted newest first');
});

test('the Client Information view is organized into the requested sections, in order, and Internal Notes is gated to staff with permission', () => {
    const markup = readRaw('views/shared-modals.html');
    const start = markup.indexOf('CLIENT INFORMATION VIEW');
    const end = markup.indexOf('CLIENT ACTION CONFIRMATION', start);
    const drawer = markup.slice(start, end);

    const sectionOrder = ['Company Profile', 'Primary Contact', 'Additional Authorized Contacts', 'Registered Address', 'Related Records', 'Internal Information', 'Documents & Billing History', 'Client Activity'];
    let cursor = -1;
    for (const label of sectionOrder) {
        const at = drawer.indexOf(label);
        assert.ok(at > -1, `section "${label}" must exist in the Client Information drawer`);
        assert.ok(at > cursor, `section "${label}" must appear after the previous section`);
        cursor = at;
    }

    assert.match(drawer, /Email Address — Primary Contact/);
    assert.match(drawer, /clientView\.client\.additionalClientEmails/);
    // Never merged: the additional-contacts block must not read clientEmail.
    const additionalBlock = drawer.slice(drawer.indexOf('ADDITIONAL AUTHORIZED CONTACTS'), drawer.indexOf('REGISTERED ADDRESS'));
    assert.doesNotMatch(additionalBlock, /clientView\.client\.clientEmail/);

    const internalBlock = drawer.slice(drawer.indexOf('INTERNAL INFORMATION'), drawer.indexOf('id="client-doc-history"'));
    assert.match(internalBlock, /v-if="canManageClients"[^>]*>\s*<p class="font-bold[^>]*>Internal Notes/s);
});

test('Related Records figures are clickable and route to the actual matching records', () => {
    const markup = readRaw('views/shared-modals.html');
    const relatedStart = markup.indexOf('RELATED RECORDS');
    const relatedBlock = markup.slice(relatedStart, markup.indexOf('INTERNAL INFORMATION', relatedStart));
    assert.match(relatedBlock, /@click="closeClientView\(\); viewClientBoard\(clientView\.client\)"/);
    const scrollButtons = relatedBlock.match(/@click="scrollClientViewTo\('client-doc-history'\)"/g) || [];
    assert.equal(scrollButtons.length, 4, 'Total Quotations, Total Invoices, Unpaid Invoices and Paid Invoices must each open the Documents & Billing History table');
});
