// The Client Access Portal, write by write, against the deployed rules.
const { test, before, after, beforeEach } = require('node:test');
const { start, stop, reset, seed, as, assertFails, assertSucceeds } = require('./harness');

const quotation = (overrides = {}) => ({
    type: 'Quotation', status: 'Open', docNo: 'QT-2026-001', name: 'CLIENTCO SDN BHD',
    subtotal: 1000, discount: 0, sst: 80, amount: 1080,
    raw: { customerId: 'CUST-1', clientEmail: 'buyer@clientco.com', projectId: 'P-1', items: [{ qty: 1, price: 1000 }] },
    ...overrides,
});
const invoice = (overrides = {}) => quotation({ type: 'Invoice', status: 'Unpaid', docNo: 'INV-2026-001', ...overrides });

before(start);
after(stop);
beforeEach(async () => {
    await reset();
    await seed({
        'customers/CUST-1': { clientName: 'CLIENTCO SDN BHD', clientEmail: 'buyer@clientco.com', clientTier: 'PREMIUM', clientTaskCreatedAt: '2026-01-01T00:00:00.000Z' },
        'customers/CUST-2': { clientName: 'ELSEWHERE BHD', clientEmail: 'someone@elsewhere.com', clientTier: 'BASIC', clientTaskCreatedAt: '2026-01-01T00:00:00.000Z' },
        'projects/P-1': { clientDirectoryId: 'CUST-1', clientPortalUid: 'u-client', clientEmail: 'buyer@clientco.com', ownerEmail: 'staff@zenqor.com.my', ownerEmpNo: 'E1', ownerName: 'PIC STAFF', clientName: 'CLIENTCO SDN BHD', projectRef: 'PRJ-1', title: 'LICENCE', status: 'In Progress' },
        'projects/P-2': { clientDirectoryId: 'CUST-2', clientPortalUid: 'u-client2', clientEmail: 'someone@elsewhere.com', ownerEmail: 'other@zenqor.com.my', ownerEmpNo: 'E2', ownerName: 'OTHER STAFF', clientName: 'ELSEWHERE BHD', projectRef: 'PRJ-2', title: 'PERMIT', status: 'In Progress' },
        'docs/Q1': quotation(),
        'docs/Q2': quotation({ docNo: 'QT-2026-002', raw: { customerId: 'CUST-2', clientEmail: 'someone@elsewhere.com', projectId: 'P-2' } }),
        'docs/I1': invoice(),
        'docs/D1': invoice({ status: 'Draft', docNo: 'INV-DRAFT' }),
    });
});

test('a client reads their own quotation and invoice, and nobody else\'s', async () => {
    const { db } = as('client');
    await assertSucceeds(db.doc('docs/Q1').get());
    await assertSucceeds(db.doc('docs/I1').get());
    await assertFails(db.doc('docs/Q2').get());
    // An unsent invoice draft stays with Finance.
    await assertFails(db.doc('docs/D1').get());
});

test('the portal\'s own document queries are allowed for a client', async () => {
    const { db } = as('client');
    await assertSucceeds(db.collection('docs').where('raw.customerId', '==', 'CUST-1').where('type', '==', 'Quotation').get());
    await assertSucceeds(db.collection('docs').where('raw.customerId', '==', 'CUST-1').where('type', '==', 'Invoice').where('status', 'not-in', ['Draft']).get());
    await assertSucceeds(db.collection('projects').where('clientDirectoryId', '==', 'CUST-1').get());
    // A broad query that could return someone else's record is refused outright.
    await assertFails(db.collection('docs').get());
});

test('a client accepts their open quotation, and cannot touch its figures', async () => {
    const { db } = as('client');
    const decision = { status: 'Accepted', clientDecisionAt: '2026-09-13T00:00:00.000Z', clientDecisionByUid: 'u-client', clientDecisionByName: 'CLIENT BUYER', clientDecisionNote: '' };
    await assertFails(db.doc('docs/Q1').update({ ...decision, amount: 1 }));
    await assertFails(db.doc('docs/Q1').update({ ...decision, clientDecisionByUid: 'someone-else' }));
    await assertFails(db.doc('docs/Q2').update(decision));
    await assertSucceeds(db.doc('docs/Q1').update(decision));
});

test('a client attaches payment proof, which never marks the invoice paid', async () => {
    const { db } = as('client');
    const proof = { paymentProofUrl: 'https://firebasestorage.googleapis.com/x', paymentProofName: 'slip.pdf', paymentProofAt: '2026-09-13T00:00:00.000Z', paymentProofByUid: 'u-client', paymentProofByName: 'CLIENT BUYER' };
    await assertFails(db.doc('docs/I1').update({ ...proof, status: 'Paid' }));
    await assertSucceeds(db.doc('docs/I1').update(proof));
});

test('a client files a document into their own repository only', async () => {
    const { db } = as('client');
    const record = (clientDirectoryId) => ({
        clientDirectoryId, fileName: 'ssm.pdf', fileType: 'application/pdf', fileSize: 1024,
        storageFileName: '1_ssm.pdf', storagePath: `client_documents/${clientDirectoryId}/1_ssm.pdf`,
        uploadedByUid: 'u-client', uploadedByEmail: 'buyer@clientco.com',
    });
    await assertSucceeds(db.doc('client_documents/CUST-1_1').set(record('CUST-1')));
    await assertFails(db.doc('client_documents/CUST-2_1').set(record('CUST-2')));
});

test('a Premium client replies on their project; a Basic one cannot', async () => {
    const reply = (uid, projectId, clientDirectoryId) => ({
        projectId, clientDirectoryId, clientPortalUid: uid, senderUid: uid, senderRole: 'Client', message: 'THANK YOU', updateType: 'Client Reply',
    });
    await assertSucceeds(as('client').db.doc('project_client_updates/R1').set(reply('u-client', 'P-1', 'CUST-1')));
    await assertFails(as('otherClient').db.doc('project_client_updates/R2').set(reply('u-client2', 'P-2', 'CUST-2')));
    // Nor on somebody else's project, whatever their tier.
    await assertFails(as('client').db.doc('project_client_updates/R3').set(reply('u-client', 'P-2', 'CUST-2')));
});

test('a client uploads into their own storage folder only', async () => {
    const { storage } = as('client');
    const bytes = Buffer.from('%PDF-1.4 test');
    await assertSucceeds(storage.ref('client_documents/CUST-1/1_ssm.pdf').put(bytes, { contentType: 'application/pdf' }));
    await assertFails(storage.ref('client_documents/CUST-2/1_ssm.pdf').put(bytes, { contentType: 'application/pdf' }));
});
