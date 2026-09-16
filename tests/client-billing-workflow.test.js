const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource } = require('./helpers/sources');

const read = (file) => readSource(file);

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
    // Sending is sendInvoiceToClient()'s own explicit action, never a side
    // effect of saveDocRecord() — see payment-invoice-delivery.test.js for the
    // full Draft -> Ready to Send -> Sent lifecycle.
    assert.match(app, /runBillingWorkflow\('invoice-sent', invoice\.id\)/);
    assert.match(app, /runBillingWorkflow\('quotation-issued', docId\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-submitted', d\.id\)/);
    assert.match(app, /runBillingWorkflow\('payment-proof-reviewed', invoice\.id/);
    assert.match(handler, /paymentProofReviewStatus: approved \? 'Verified' : 'Rejected'/);
    assert.match(rules, /clientCanReadInvoice\(resource\.data\)/);
    assert.match(rules, /data\.deliveryStatus == 'Sent'/);
    assert.match(rules, /match \/billing_events\/\{eventId\}/);
    assert.match(rules, /allow read, write: if false/);
    assert.match(page, /Client Billing Workflow/);
    assert.match(page, /Upload Corrected Proof/);
});

test('a newly issued quotation or invoice notifies the linked Client contacts', () => {
    const app = read('app.js');

    assert.match(app, /const isQuotationBeingIssued = payload\.type === 'Quotation'/);
    assert.match(app, /subject: `Quotation Ready — \$\{payload\.docNo\}`/);
    // The invoice email moved with the send action itself — sendInvoiceToClient()
    // is the only place it fires, using invoice.docNo (the object passed to it),
    // not the saveDocRecord() payload.
    assert.match(app, /subject: `Invoice Ready — \$\{invoice\.docNo\}`/);
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

test('every stage change is filed in an append-only billing timeline', () => {
    const app = read('app.js');
    const handler = read('api/billing-workflow.js');
    const rules = read('firestore.rules');
    const page = read('index.html');

    // The history is its own collection, not a field on the document, so a
    // later status change cannot overwrite what the document used to be.
    assert.match(rules, /match \/billing_timeline\/\{entryId\}/);
    assert.match(handler, /db\.collection\('billing_timeline'\)/);
    assert.match(handler, /function recordTimelineInTransaction/);
    assert.match(handler, /function buildTimelineEntry/);

    // Every stage the spec names reaches the timeline.
    ['quotation_created', 'quotation_sent', 'quotation_accepted', 'invoice_created', 'invoice_sent',
        'payment_proof_submitted', 'payment_under_review', 'payment_verified', 'paid',
        'quotation_declined', 'payment_proof_rejected', 'invoice_cancelled']
        .forEach(stage => assert.match(handler, new RegExp(`'${stage}'`), `${stage} is never recorded`));

    // What an audit needs on each entry: who, when, from, to, and — where the
    // stage is about money — the proof and the person who verified it.
    ['actorUid', 'actorName', 'actorRole', 'fromStatus', 'toStatus', 'paymentProofUrl', 'verifiedByUid']
        .forEach(field => assert.match(handler, new RegExp(field), `${field} is not recorded`));

    assert.match(app, /runBillingWorkflow\('document-created', docId\)/);
    assert.match(app, /runBillingWorkflow\('quotation-declined', d\.id\)/);
    assert.match(app, /runBillingWorkflow\('invoice-cancelled', invoice\.id/);
    assert.match(app, /async openBillingTimeline\(item\)/);
    assert.match(page, /Billing Workflow Position/);
    assert.match(page, /View Full History/);
});

test('the timeline is readable by the document\'s own people and writable by nobody', () => {
    const rules = read('firestore.rules');
    const timeline = rules.slice(rules.indexOf('match /billing_timeline/{entryId}'));
    const block = timeline.slice(0, timeline.indexOf('\n    }') + 6);

    // No browser session writes here — not a Client, not a PIC, not a
    // Superadmin. Only the Admin SDK behind /api/billing-workflow.
    assert.match(block, /allow write: if false;/);
    assert.doesNotMatch(block, /allow (create|update|delete)/);

    // Reads follow the document: billing roles, the assigned PIC, the Client.
    assert.match(block, /isAdmin\(\) \|\| isHR\(\) \|\| isAccount\(\) \|\| isIT\(\)/);
    assert.match(block, /resource\.data\.picEmail == request\.auth\.token\.email/);
    assert.match(block, /resource\.data\.clientEmail == request\.auth\.token\.email/);
    // A secondary Client contact is matched by claim, not by a per-row get():
    // one document lookup per returned row would hit the rules access limit.
    assert.match(block, /resource\.data\.customerId == request\.auth\.token\.clientDirectoryId/);
    assert.doesNotMatch(block, /customerEmailMatches\(get\(/);
});

test('the portal and the handler name the billing stages identically', () => {
    const constants = read('app/constants/billing-workflow.js');
    const serverStages = read('api/_billingStages.js');

    // Two runtimes, two copies, one vocabulary. A stage renamed in one place
    // and not the other would show a client "Recorded" instead of the label.
    const labelsOf = (source) => [...source.matchAll(/(quotation_created|quotation_sent|quotation_accepted|invoice_created|invoice_sent|payment_proof_submitted|payment_under_review|payment_verified|paid|quotation_declined|payment_proof_rejected|invoice_cancelled)/g)]
        .map(match => match[1]);
    const portalKeys = new Set(labelsOf(constants));
    const serverKeys = new Set(labelsOf(serverStages));
    assert.deepEqual([...portalKeys].sort(), [...serverKeys].sort());

    // The current stage is derived from the saved record, so the Status
    // dropdown cannot claim a stage the document never went through.
    assert.match(constants, /export function billingStageOfDocument/);
    assert.match(constants, /if \(item\.paymentProofReviewStatus === 'Submitted'\) return 'payment_under_review'/);
});

test('Assign names the responsible PIC and no longer doubles as the status', () => {
    const app = read('app.js');
    const page = read('index.html');

    // The list is grouped by project stage and finished projects are out of
    // the way by default — a client with years of history had every closed
    // project sitting in the same flat list as the open ones.
    assert.match(app, /documentProjectGroupsForSelectedClient\(\)/);
    assert.match(app, /documentProjectShowClosed/);
    assert.match(app, /CLOSED_PROJECT_STAGES = \['Completed & Done'\]/);
    // Nothing is filtered by reference prefix: staff invent their own
    // references, and a prefix rule would silently drop a real project.
    assert.doesNotMatch(app, /projectRef.*startsWith\('NDA/);
    assert.match(app, /selectedDocumentProject\(\)/);
    assert.match(page, /<optgroup v-for="group in documentProjectGroupsForSelectedClient"/);
    assert.match(page, /Person In Charge/);
    assert.match(page, /It is not the workflow status/);
});

test('an issued invoice is cancelled rather than deleted, and a paid one is neither', () => {
    const app = read('app.js');
    const handler = read('api/billing-workflow.js');
    const page = read('index.html');

    assert.match(handler, /action === 'invoice-cancelled'/);
    assert.match(handler, /A verified, paid invoice cannot be cancelled/);
    assert.match(handler, /status: 'Cancelled'/);
    assert.match(app, /async cancelInvoiceFromWorkflow\(invoice\)/);
    assert.match(page, /Cancel Invoice/);
    // A cancelled invoice keeps its history but leaves the review queue:
    // there is nothing left for Finance to verify on it.
    assert.match(app, /!\['Draft', 'Paid', 'Cancelled'\]\.includes\(item\.status\) && item\.paymentProofUrl/);
    assert.match(app, /\['Paid', 'Cancelled'\]\.includes\(d\.status\)/);
});
