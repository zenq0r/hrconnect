const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('accepted quotations use a server-owned PIC and Finance handover', () => {
    const app = read('app.js');
    const handler = read('api/billing-workflow.js');
    const page = read('index.html');

    assert.match(app, /await this\.runBillingWorkflow\('quotation-accepted', d\.id\)/);
    assert.match(handler, /async function resolveProject/);
    assert.match(handler, /createPicHandover/);
    assert.match(handler, /recipientsForRoles\(db, \['Account', 'Director', 'Superadmin'\]\)/);
    assert.match(handler, /document\.clientDecisionByUid !== identity\.uid/);
    assert.match(page, /Assigned Project \/ PIC/);
    assert.match(app, /Select the assigned project\/PIC before saving a quotation/);
});

test('invoice draft, issue, proof and verification form one controlled flow', () => {
    const app = read('app.js');
    const rules = read('firestore.rules');
    const page = read('index.html');
    const handler = read('api/billing-workflow.js');

    assert.match(app, /createInvoiceFromQuotation/);
    assert.match(app, /status: 'Draft'/);
    assert.match(app, /runBillingWorkflow\('invoice-sent', docId\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-submitted', d\.id\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-reviewed', invoice\.id/);
    assert.match(handler, /paymentProofReviewStatus: approved \? 'Verified' : 'Rejected'/);
    assert.match(rules, /resource\.data\.status != 'Draft'/);
    assert.match(rules, /match \/billing_events\/\{eventId\}/);
    assert.match(rules, /allow read, write: if false/);
    assert.match(page, /Client Billing Workflow/);
    assert.match(page, /Upload Corrected Proof/);
});

test('all staff see the workflow, while only Finance, Director and an assigned PIC see a work item', () => {
    const app = read('app.js');
    const page = read('index.html');
    const handler = read('api/billing-workflow.js');

    assert.match(app, /canViewBillingWorkflow\(\) \{ return this\.userProfile\.role !== 'Client'; \}/);
    assert.match(app, /\['quotation-accepted', 'payment-proof-submitted'\]\.includes/);
    assert.match(page, /v-if="canViewBillingWorkflow"/);
    assert.match(page, /Workflow availability is visible to all staff/);
    assert.match(page, /Assigned PIC handover/);
    assert.match(page, /Only the assigned PIC, Finance and Director can access Client billing records and actions/);
    assert.match(handler, /'payment-proof-submitted'\);/);
});
