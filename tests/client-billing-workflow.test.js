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
    assert.match(app, /Select the exact assigned project\/PIC before saving this billing document/);
});

test('invoice draft, issue, proof and verification form one controlled flow', () => {
    const app = read('app.js');
    const rules = read('firestore.rules');
    const page = read('index.html');
    const handler = read('api/billing-workflow.js');

    assert.match(app, /createInvoiceFromQuotation/);
    assert.match(app, /status: 'Draft'/);
    assert.match(app, /runBillingWorkflow\('invoice-sent', docId\)/);
    assert.match(app, /runBillingWorkflow\('quotation-issued', docId\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-submitted', d\.id\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-reviewed', invoice\.id/);
    assert.match(handler, /paymentProofReviewStatus: approved \? 'Verified' : 'Rejected'/);
    assert.match(rules, /resource\.data\.status != 'Draft'/);
    assert.match(rules, /match \/billing_events\/\{eventId\}/);
    assert.match(rules, /allow read, write: if false/);
    assert.match(page, /Client Billing Workflow/);
    assert.match(page, /Upload Corrected Proof/);
});

test('a newly issued quotation or invoice notifies the linked Client contacts', () => {
    const app = read('app.js');

    assert.match(app, /const isQuotationBeingIssued = payload\.type === 'Quotation'/);
    assert.match(app, /subject: `Quotation Ready — \$\{payload\.docNo\}`/);
    assert.match(app, /subject: `Invoice Ready — \$\{payload\.docNo\}`/);
    assert.match(app, /to: payload\.raw\.clientEmail/);
    assert.match(app, /ctaLabel: 'VIEW QUOTATION'/);
    assert.match(app, /ctaLabel: 'VIEW INVOICE'/);
});

test('only the PIC, HR, Finance and full access roles receive Client Billing Workflow actions', () => {
    const app = read('app.js');
    const page = read('index.html');
    const handler = read('api/billing-workflow.js');
    const rules = read('firestore.rules');

    assert.match(app, /isBillingProjectPic\(\) \{ return this\.billingPicProjectIds\.size > 0; \}/);
    assert.match(app, /canManageBillingWorkflow\(\) \{ return this\.isFullAccessRole; \}/);
    assert.match(app, /canVerifyPaymentProof\(\) \{ return this\.isFullAccessRole \|\| \['HR', 'Account'\]\.includes/);
    assert.match(page, /v-if="canViewBillingWorkflow"/);
    assert.match(page, /Only PIC Project Activities, HR, Finance, Director and Superadmin can access this workflow/);
    assert.match(page, /Delete Invoice/);
    assert.match(app, /deleteInvoiceFromWorkflow/);
    assert.match(handler, /INVOICE_MANAGEMENT_ROLES = new Set\(\['Director', 'Superadmin'\]\)/);
    assert.match(handler, /PAYMENT_REVIEW_ROLES = new Set\(\['HR', 'Account'\]\)/);
    assert.match(handler, /callerIsProjectPic/);
});

test('billing workflows are bound to the exact Client ID and assigned project', () => {
    const app = read('app.js');
    const handler = read('api/billing-workflow.js');

    assert.match(app, /billingClientId: String\(this\.docForm\.customerId \|\| ''\)\.trim\(\)/);
    assert.match(app, /billingProjectId: String\(this\.docForm\.projectId \|\| ''\)\.trim\(\)/);
    assert.match(app, /The selected project belongs to a different Client ID/);
    assert.match(handler, /const projectId = String\(raw\.projectId \|\| ''\)\.trim\(\)/);
    assert.match(handler, /if \(!customerId \|\| !projectId\) return null/);
    assert.match(handler, /String\(project\.clientDirectoryId \|\| ''\)\.trim\(\) === customerId/);
    assert.doesNotMatch(handler, /where\('clientDirectoryId', '==', customerId\)/);
    assert.match(handler, /action === 'quotation-issued'/);
});

test('project details show only billing documents bound to that Client ID and project', () => {
    const app = read('app.js');
    const page = read('index.html');

    assert.match(app, /projectBillingDocuments\(project\)/);
    assert.match(app, /String\(item\?\.raw\?\.projectId \|\| ''\)\.trim\(\) === projectId/);
    assert.match(app, /String\(item\?\.raw\?\.customerId \|\| ''\)\.trim\(\) === customerId/);
    assert.match(page, /Quotation &amp; Invoice/);
    assert.match(page, /projectBillingDocuments\(projectPreview\.project\)/);
});

test('Client document listeners are compatible with the no-draft access rule', () => {
    const app = read('app.js');
    const indexes = read('firestore.indexes.json');

    assert.match(app, /const clientDocumentSources = role === 'Client'/);
    assert.match(app, /where\('raw\.customerId', '==', clientDirectoryId\), where\('type', '==', 'Quotation'\)/);
    assert.match(app, /where\('raw\.customerId', '==', clientDirectoryId\), where\('type', '==', 'Invoice'\), where\('status', 'not-in', \['Draft'\]\)/);
    assert.match(app, /where\('raw\.clientEmail', '==', clientEmail\), where\('type', '==', 'Quotation'\)/);
    assert.match(app, /subscribeMergedWithReadySignal\(clientDocumentSources/);
    assert.match(app, /\(clientDirectoryId && String\(d\.raw\.customerId \|\| ''\)\.trim\(\) === clientDirectoryId\) \|\|/);
    assert.match(indexes, /"fieldPath": "raw\.customerId"/);
    assert.match(indexes, /"fieldPath": "raw\.clientEmail"/);
});
