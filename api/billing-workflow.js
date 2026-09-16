// Server-authoritative bridge for Client billing actions. The browser may state
// that a quotation was accepted or a proof was uploaded, but only this handler
// decides who receives the internal handover and what the next workflow state is.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { normalizeEmail, isSeedAdminEmail, PORTAL_URL } = require('./_security');
const { enforceRateLimit } = require('./_rateLimit');
const { secondFactorSatisfied } = require('./_portalClaims');
const { billingStageLabel } = require('./_billingStages');

const INVOICE_MANAGEMENT_ROLES = new Set(['Director', 'Superadmin']);
const PAYMENT_REVIEW_ROLES = new Set(['HR', 'Account']);
// Quotation publishing can be performed by the document team. Invoice issuing
// remains restricted to the full-access roles above.
const DOCUMENT_ISSUE_ROLES = new Set(['Director', 'Superadmin', 'HR', 'Account']);

// Same order/fallback as CLIENT_TIER_ORDER + canonicalClientTier in
// app/constants/client-tiers.js — kept in sync by hand since api/ (CommonJS)
// cannot import that ES module directly. An unknown/missing tier is Standard.
const CLIENT_TIER_ORDER = ['Standard', 'Premium', 'Priority'];
function clientTierIndexOf(value) {
    const wanted = String(value || '').trim().toUpperCase();
    const index = CLIENT_TIER_ORDER.findIndex(tier => tier.toUpperCase() === wanted);
    return index === -1 ? 0 : index;
}

function clientOwnsCustomer(customer, email) {
    const normalized = normalizeEmail(email);
    if (!normalized || !customer) return false;
    return normalizeEmail(customer.clientEmail) === normalized ||
        (Array.isArray(customer.additionalClientEmails) && customer.additionalClientEmails.map(normalizeEmail).includes(normalized));
}

async function recipientsForRoles(db, roles) {
    const snapshot = await db.collection('users').where('role', 'in', [...roles]).get();
    return snapshot.docs.map((entry) => normalizeEmail(entry.data().email)).filter(Boolean);
}

async function createPortalNotifications(db, emails, notification) {
    const wanted = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
    if (!wanted.length) return 0;
    const recipients = new Map();
    for (let index = 0; index < wanted.length; index += 10) {
        const users = await db.collection('users').where('email', 'in', wanted.slice(index, index + 10)).get();
        users.docs.forEach((entry) => recipients.set(entry.id, normalizeEmail(entry.data().email)));
    }
    if (!recipients.size) return 0;
    const batch = db.batch();
    const now = new Date().toISOString();
    recipients.forEach((email, uid) => {
        batch.set(db.collection('portal_notifications').doc(), {
            recipientUid: uid,
            recipientEmail: email,
            title: notification.title,
            message: notification.message,
            actionLabel: notification.actionLabel || 'OPEN PORTAL',
            actionUrl: PORTAL_URL,
            createdAt: now,
            read: false,
            workflow: 'client-billing'
        });
    });
    await batch.commit();
    return recipients.size;
}

async function resolveProject(db, document) {
    const raw = document.raw || {};
    const customerId = String(raw.customerId || '').trim();
    const projectId = String(raw.projectId || '').trim();
    // Never infer a project by choosing a Client's latest task. A PIC can own
    // several Client tasks, so every billing document must name its exact
    // customer and project, and the pair must agree before notifications or
    // handovers can be created.
    if (!customerId || !projectId) return null;
    const direct = await db.collection('projects').doc(projectId).get();
    if (!direct.exists) return null;
    const project = { id: direct.id, ...direct.data() };
    return String(project.clientDirectoryId || '').trim() === customerId ? project : null;
}

async function callerIsProjectPic(db, document, email) {
    const project = await resolveProject(db, document);
    return Boolean(project && normalizeEmail(project.ownerEmail) === normalizeEmail(email));
}

async function createPicHandover(db, documentId, document, project, timestamp, workflowSource = 'quotation-accepted') {
    if (!project?.id || !normalizeEmail(project.ownerEmail)) return false;
    const isPaymentProof = workflowSource === 'payment-proof-submitted';
    const proofVersion = String(document.paymentProofAt || timestamp).replace(/[^a-zA-Z0-9]/g, '');
    const activityRef = db.collection('project_activities').doc(isPaymentProof ? `billing-proof-${documentId}-${proofVersion}` : `billing-${documentId}`);
    const existing = await activityRef.get();
    if (existing.exists) return false;
    await activityRef.set({
        projectId: project.id,
        projectRef: project.projectRef || '',
        projectTitle: project.title || 'Client project',
        projectOwnerEmail: normalizeEmail(project.ownerEmail),
        activityType: 'Billing handover',
        summary: isPaymentProof
            ? `Client submitted payment proof for ${document.docNo}. Finance and Director are reviewing it.`
            : `Client accepted quotation ${document.docNo}. Confirm scope and hand over to Finance.`,
        details: isPaymentProof
            ? 'This task was created automatically from the Client Portal. Finance and Director have been notified to verify the payment proof.'
            : 'This task was created automatically from the Client Portal. Finance and Director have been notified in parallel.',
        dueDate: timestamp.slice(0, 10),
        assignedEmpNo: project.ownerEmpNo || '',
        assignedName: project.ownerName || project.ownerEmail,
        assignedEmail: normalizeEmail(project.ownerEmail),
        assignedPosition: project.ownerPosition || 'Person In Charge',
        status: 'Scheduled',
        createdAt: timestamp,
        createdByUid: 'system:client-billing-workflow',
        createdByEmail: 'system@zenqor.com.my',
        workflowSource,
        ...(isPaymentProof
            ? { invoiceId: documentId, invoiceNo: document.docNo || '' }
            : { quotationId: documentId, quotationNo: document.docNo || '' })
    });
    return true;
}

function safeNote(value) {
    return typeof value === 'string' ? value.trim().slice(0, 1000) : '';
}

// ---------------------------------------------------------------------------
// The billing timeline
//
// One document per stage change, never edited and never deleted, so the full
// history of a quotation or invoice survives every later status change. The
// status fields on docs/{id} answer "where is this now"; billing_timeline
// answers "how did it get here, and who moved it".
//
// The id is derived from the document and the event rather than generated, so
// a retried request re-writes the same entry instead of adding a duplicate.
// `version` exists because two of these events legitimately repeat: a client
// may submit proof more than once, and each submission is reviewed on its own.
// ---------------------------------------------------------------------------
function timelineEntryId(documentId, stage, version = '') {
    const suffix = String(version || '').replace(/[^a-zA-Z0-9]/g, '');
    return `${documentId}__${stage}${suffix ? `__${suffix}` : ''}`;
}

function buildTimelineEntry(options) {
    const {
        documentId,
        document,
        project,
        customer,
        stage,
        fromStatus = '',
        toStatus = '',
        actorUid = '',
        actorName = '',
        actorEmail = '',
        actorRole = '',
        note = '',
        timestamp,
        extra = {}
    } = options;
    return {
        documentId,
        documentNo: document?.docNo || '',
        documentType: document?.type || '',
        amount: Number(document?.amount) || 0,
        customerId: String(document?.raw?.customerId || ''),
        clientName: document?.name || '',
        clientEmail: normalizeEmail(document?.raw?.clientEmail) || '',
        // Copied onto the entry rather than looked up later: a project can be
        // renamed or handed to another PIC, and the history should still read
        // as it did on the day the stage was recorded.
        projectId: project?.id || String(document?.raw?.projectId || ''),
        projectRef: project?.projectRef || String(document?.raw?.projectRef || ''),
        projectTitle: project?.title || String(document?.raw?.projectTitle || ''),
        // The PIC is what lets that one staff account read this entry at all
        // (see billing_timeline in firestore.rules), so fall back to the
        // document's own index when the project could not be resolved.
        picEmail: normalizeEmail(project?.ownerEmail) || normalizeEmail(document?.billingPicEmail) || '',
        picName: project?.ownerName || '',
        clientDirectoryId: String(customer?.clientId || document?.raw?.customerId || ''),
        stage,
        stageLabel: billingStageLabel(stage),
        fromStatus,
        toStatus,
        actorUid,
        actorName,
        actorEmail: normalizeEmail(actorEmail) || '',
        actorRole,
        note: safeNote(note),
        at: timestamp,
        // Milliseconds as a tiebreaker: two entries written in the same second
        // still sort deterministically, without needing a server counter.
        seq: Date.parse(timestamp) || Date.now(),
        source: 'api/billing-workflow',
        ...extra
    };
}

// Inside a transaction, so the stage change and its history entry either both
// land or neither does.
function recordTimelineInTransaction(db, transaction, options) {
    const ref = db.collection('billing_timeline').doc(timelineEntryId(options.documentId, options.stage, options.version));
    transaction.set(ref, buildTimelineEntry(options), { merge: true });
}

// For the one action that is not transactional (payment-proof-reviewed reads
// and writes a single document). A failure here must not undo a verification
// the client has already been told about, so it is logged, not thrown.
async function recordTimeline(db, options) {
    try {
        const ref = db.collection('billing_timeline').doc(timelineEntryId(options.documentId, options.stage, options.version));
        await ref.set(buildTimelineEntry(options), { merge: true });
        return true;
    } catch (error) {
        console.error('billing timeline write failed:', options.stage, error);
        return false;
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    try {
        const token = String(req.headers.authorization || '').startsWith('Bearer ')
            ? String(req.headers.authorization).slice(7) : '';
        if (!token) { res.status(401).json({ error: 'Missing authorization token.' }); return; }
        const auth = getAdminAuth();
        const db = getAdminFirestore();
        const identity = await auth.verifyIdToken(token);
        const callerSnapshot = await db.collection('users').doc(identity.uid).get();
        const caller = callerSnapshot.exists ? callerSnapshot.data() : null;
        const callerRole = caller?.role || (isSeedAdminEmail(identity.email) ? 'Superadmin' : '');
        if (!secondFactorSatisfied(identity, callerRole)) {
            res.status(403).json({ error: 'Confirm the sign-in code for this session first. Sign out, sign in again and enter the code sent to your email.' }); return;
        }
        const { action, documentId } = req.body || {};
        if (!['document-created', 'quotation-issued', 'quotation-accepted', 'quotation-declined', 'invoice-sent', 'invoice-cancelled', 'payment-proof-submitted', 'payment-proof-reviewed'].includes(action) || typeof documentId !== 'string' || !documentId) {
            res.status(400).json({ error: 'Invalid workflow request.' }); return;
        }
        // The ceiling rose from 20 with document-created and the two branch
        // actions: a Finance session now files a timeline entry per stage
        // instead of only at the three notification points.
        const rate = await enforceRateLimit(db, { scope: 'billing-workflow', key: identity.uid, limit: 40, windowMs: 5 * 60 * 1000 });
        if (!rate.allowed) { res.setHeader('Retry-After', String(rate.retryAfterSeconds)); res.status(429).json({ error: 'Too many workflow requests. Please try again shortly.' }); return; }

        const documentRef = db.collection('docs').doc(documentId);
        const documentSnapshot = await documentRef.get();
        if (!documentSnapshot.exists) { res.status(404).json({ error: 'Document not found.' }); return; }
        const document = { id: documentSnapshot.id, ...documentSnapshot.data() };
        const customerId = String(document.raw?.customerId || '');
        const customerSnapshot = customerId ? await db.collection('customers').doc(customerId).get() : null;
        const customer = customerSnapshot?.exists ? customerSnapshot.data() : null;
        const clientOwnsDocument = callerRole === 'Client' && clientOwnsCustomer(customer, identity.email);
        const timestamp = new Date().toISOString();
        const actor = {
            actorUid: identity.uid,
            actorName: caller?.name || identity.email || '',
            actorEmail: identity.email || '',
            actorRole: callerRole || ''
        };

        // The first entry in a document's history: it exists, as a draft, and
        // this is who made it. Nothing is notified and no status moves — the
        // point is only that "Created" is on the record before "Sent" is, so a
        // timeline never starts halfway through.
        if (action === 'document-created') {
            if (!DOCUMENT_ISSUE_ROLES.has(callerRole) || !['Quotation', 'Invoice'].includes(document.type)) {
                res.status(403).json({ error: 'Only an authorized document manager may open a billing document.' }); return;
            }
            const project = await resolveProject(db, document);
            const stage = document.type === 'Quotation' ? 'quotation_created' : 'invoice_created';
            await recordTimeline(db, {
                documentId, document, project, customer, stage,
                fromStatus: '',
                toStatus: document.status || '',
                note: safeNote(req.body?.note),
                timestamp,
                ...actor,
                ...(document.raw?.sourceQuotationNo ? { extra: { sourceQuotationNo: document.raw.sourceQuotationNo, sourceQuotationId: document.raw.sourceQuotationId || '' } } : {})
            });
            res.status(200).json({ success: true, stage }); return;
        }

        if (action === 'quotation-issued') {
            if (!DOCUMENT_ISSUE_ROLES.has(callerRole) || document.type !== 'Quotation' || document.status !== 'Open') {
                res.status(403).json({ error: 'Only an authorized document manager may issue an open quotation.' }); return;
            }
            const project = await resolveProject(db, document);
            if (!customer || !project) {
                res.status(409).json({ error: 'The document Client ID and assigned project do not match. Re-select the Client and its project before issuing it.' }); return;
            }
            const eventRef = db.collection('billing_events').doc(`${documentId}_quotation_issued`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, issuedByUid: identity.uid, customerId, projectId: project.id, createdAt: timestamp });
                transaction.update(documentRef, {
                    billingWorkflowStatus: 'Quotation Sent to Client',
                    billingWorkflowUpdatedAt: timestamp,
                    billingStage: 'quotation_sent',
                    billingClientId: customerId,
                    billingProjectId: project.id,
                    billingPicEmail: normalizeEmail(project.ownerEmail)
                });
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'quotation_sent',
                    fromStatus: 'Draft',
                    toStatus: 'Open',
                    timestamp,
                    ...actor
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            const recipients = [customer.clientEmail, ...(Array.isArray(customer.additionalClientEmails) ? customer.additionalClientEmails : [])];
            const count = await createPortalNotifications(db, recipients, {
                title: `Quotation issued — ${document.docNo}`,
                message: `Your quotation for ${document.name || 'your account'} is ready. Review it in Documents & Billing.`,
                actionLabel: 'OPEN QUOTATION'
            });
            res.status(200).json({ success: true, recipients: count }); return;
        }

        if (action === 'quotation-accepted') {
            if (!clientOwnsDocument || document.type !== 'Quotation' || document.status !== 'Accepted' || document.clientDecisionByUid !== identity.uid) {
                res.status(403).json({ error: 'This accepted quotation cannot start a workflow for this account.' }); return;
            }
            const project = await resolveProject(db, document);
            if (!customer || !project) {
                res.status(409).json({ error: 'The accepted quotation has an invalid Client ID and project link. No workflow was started.' }); return;
            }
            const eventRef = db.collection('billing_events').doc(`${documentId}_quotation_accepted`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, clientUid: identity.uid, customerId, projectId: project.id, createdAt: timestamp });
                transaction.update(documentRef, { billingWorkflowStatus: 'Awaiting Finance Invoice', billingWorkflowUpdatedAt: timestamp, billingStage: 'quotation_accepted', billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) });
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'quotation_accepted',
                    fromStatus: 'Open',
                    toStatus: 'Accepted',
                    note: document.clientDecisionNote || '',
                    timestamp,
                    ...actor,
                    actorName: document.clientDecisionByName || actor.actorName
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            await createPicHandover(db, documentId, document, project, timestamp);
            const recipients = [project?.ownerEmail, ...(await recipientsForRoles(db, ['Account', 'Director', 'Superadmin']))];
            const count = await createPortalNotifications(db, recipients, {
                title: `Quotation accepted — ${document.docNo}`,
                message: `${document.name || 'Client'} accepted ${document.docNo}. PIC has a handover task; Finance should prepare the invoice.`,
                actionLabel: 'OPEN BILLING'
            });
            res.status(200).json({ success: true, recipients: count }); return;
        }

        // A decline is a real outcome, not an absence of one. It ends the
        // ladder for this quotation and says so in the history, which is what
        // makes "why was this never invoiced" answerable months later.
        if (action === 'quotation-declined') {
            if (!clientOwnsDocument || document.type !== 'Quotation' || document.status !== 'Rejected' || document.clientDecisionByUid !== identity.uid) {
                res.status(403).json({ error: 'This declined quotation cannot start a workflow for this account.' }); return;
            }
            const project = await resolveProject(db, document);
            const eventRef = db.collection('billing_events').doc(`${documentId}_quotation_declined`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, clientUid: identity.uid, customerId, projectId: project?.id || '', createdAt: timestamp });
                transaction.update(documentRef, { billingWorkflowStatus: 'Quotation Declined', billingWorkflowUpdatedAt: timestamp, billingStage: 'quotation_declined' });
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'quotation_declined',
                    fromStatus: 'Open',
                    toStatus: 'Rejected',
                    note: document.clientDecisionNote || '',
                    timestamp,
                    ...actor,
                    actorName: document.clientDecisionByName || actor.actorName
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            const recipients = [project?.ownerEmail, ...(await recipientsForRoles(db, ['Account', 'Director', 'Superadmin']))];
            const count = await createPortalNotifications(db, recipients, {
                title: `Quotation declined — ${document.docNo}`,
                message: `${document.name || 'Client'} declined ${document.docNo}. No invoice is due; a revised quotation can be issued from Billing.`,
                actionLabel: 'OPEN BILLING'
            });
            res.status(200).json({ success: true, recipients: count }); return;
        }

        if (action === 'payment-proof-submitted') {
            if (!clientOwnsDocument || document.type !== 'Invoice' || !document.paymentProofUrl || document.paymentProofByUid !== identity.uid) {
                res.status(403).json({ error: 'This payment proof cannot be submitted for workflow review.' }); return;
            }
            const project = await resolveProject(db, document);
            if (!customer || !project) {
                res.status(409).json({ error: 'The invoice Client ID and assigned project do not match. Payment proof was not routed.' }); return;
            }
            const eventRef = db.collection('billing_events').doc(`${documentId}_proof_${String(document.paymentProofAt || '').replace(/[^a-zA-Z0-9]/g, '')}`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, clientUid: identity.uid, customerId, projectId: project.id, createdAt: timestamp });
                transaction.update(documentRef, { paymentProofReviewStatus: 'Submitted', billingWorkflowStatus: 'Payment Proof Review', billingWorkflowUpdatedAt: timestamp, billingStage: 'payment_under_review', billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) });
                // Two entries, because the client's act and the staff duty it
                // creates are different facts: the proof arrived, and it is now
                // waiting on a human. A resubmission files a fresh pair rather
                // than overwriting the earlier attempt.
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'payment_proof_submitted',
                    version: document.paymentProofAt || timestamp,
                    fromStatus: document.status || 'Unpaid',
                    toStatus: document.status || 'Unpaid',
                    timestamp,
                    ...actor,
                    actorName: document.paymentProofByName || actor.actorName,
                    extra: {
                        paymentProofUrl: document.paymentProofUrl || '',
                        paymentProofName: document.paymentProofName || '',
                        paymentProofAt: document.paymentProofAt || timestamp
                    }
                });
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'payment_under_review',
                    version: document.paymentProofAt || timestamp,
                    fromStatus: document.status || 'Unpaid',
                    toStatus: document.status || 'Unpaid',
                    note: 'Routed to Finance, Director and the assigned PIC for verification.',
                    timestamp,
                    actorUid: 'system:client-billing-workflow',
                    actorName: 'ZENQOR Billing Workflow',
                    actorEmail: 'system@zenqor.com.my',
                    actorRole: 'System',
                    extra: { paymentProofAt: document.paymentProofAt || timestamp }
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            await createPicHandover(db, documentId, document, project, timestamp, 'payment-proof-submitted');
            const recipients = [project?.ownerEmail, ...(await recipientsForRoles(db, ['Account', 'Director', 'Superadmin']))];
            const count = await createPortalNotifications(db, recipients, {
                title: `Payment proof submitted — ${document.docNo}`,
                message: `${document.name || 'Client'} submitted payment proof for ${document.docNo}. Finance must verify it before settlement.`,
                actionLabel: 'REVIEW PAYMENT'
            });
            // Premium+ 'advanced-notifications': a receipt confirmation pushed back to
            // the client themselves, immediately — Standard only learns the same thing
            // by opening the portal and reading the status badge. This is a deliberately
            // local, minimal copy of app/constants/client-tiers.js' tier ranking: api/
            // runs as CommonJS on the server, app/ as ES modules in the browser, and the
            // two are not meant to import across that boundary.
            if (clientTierIndexOf(customer?.clientTier) >= 1) {
                await createPortalNotifications(db, [identity.email], {
                    title: `Payment proof received — ${document.docNo}`,
                    message: `We received your payment proof for ${document.docNo}. Finance is reviewing it now.`,
                    actionLabel: 'VIEW INVOICE'
                });
            }
            res.status(200).json({ success: true, recipients: count }); return;
        }

        if (document.type !== 'Invoice') {
            res.status(403).json({ error: 'This billing action requires an invoice.' }); return;
        }

        if (action === 'invoice-sent') {
            if (!INVOICE_MANAGEMENT_ROLES.has(callerRole)) {
                res.status(403).json({ error: 'Only Director or Superadmin may issue an invoice.' }); return;
            }
            if (document.status !== 'Unpaid') { res.status(409).json({ error: 'Only an unpaid invoice can be sent to the client.' }); return; }
            const project = await resolveProject(db, document);
            if (!customer || !project) {
                res.status(409).json({ error: 'The invoice Client ID and assigned project do not match. It was not sent.' }); return;
            }
            // deliveryStatus, not status, is what actually governs whether a
            // client can read this invoice (see firestore.rules) — this is the
            // one place it ever becomes 'Sent'. The source quotation's status
            // moves to 'Invoiced' in the same transaction: previously a separate
            // client-side write, now atomic with the send itself.
            const sourceQuotationId = String(document.raw?.sourceQuotationId || '');
            const eventRef = db.collection('billing_events').doc(`${documentId}_invoice_sent`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, sentByUid: identity.uid, customerId, projectId: project.id, createdAt: timestamp });
                transaction.update(documentRef, {
                    deliveryStatus: 'Sent',
                    billingWorkflowStatus: 'Sent to Client',
                    billingStage: 'invoice_sent',
                    invoiceSentAt: timestamp,
                    invoiceSentByUid: identity.uid,
                    invoiceSentByName: caller?.name || identity.email,
                    billingClientId: customerId,
                    billingProjectId: project.id,
                    billingPicEmail: normalizeEmail(project.ownerEmail)
                });
                if (sourceQuotationId) {
                    transaction.update(db.collection('docs').doc(sourceQuotationId), { status: 'Invoiced', invoiceDocId: documentId, invoiceCreatedAt: timestamp });
                }
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'invoice_sent',
                    fromStatus: 'Draft',
                    toStatus: 'Unpaid',
                    timestamp,
                    ...actor,
                    extra: document.raw?.sourceQuotationNo ? { sourceQuotationNo: document.raw.sourceQuotationNo, sourceQuotationId: document.raw.sourceQuotationId || '' } : {}
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            const recipients = [customer?.clientEmail, ...(Array.isArray(customer?.additionalClientEmails) ? customer.additionalClientEmails : [])];
            const count = await createPortalNotifications(db, recipients, {
                title: `Invoice issued — ${document.docNo}`,
                message: `Your invoice for ${document.name || 'your account'} is ready. Review it in Documents & Billing and upload payment proof once paid.`,
                actionLabel: 'OPEN INVOICE'
            });
            res.status(200).json({ success: true, recipients: count }); return;
        }

        // Cancelling supersedes an issued invoice without removing it. Deleting
        // is still available to Finance for an unsent draft; anything the
        // client has already seen is closed off in the history instead, so the
        // document number is never quietly reused for something else.
        if (action === 'invoice-cancelled') {
            if (!INVOICE_MANAGEMENT_ROLES.has(callerRole)) {
                res.status(403).json({ error: 'Only Director or Superadmin may cancel an issued invoice.' }); return;
            }
            if (document.status === 'Paid' || document.paymentProofReviewStatus === 'Verified') {
                res.status(409).json({ error: 'A verified, paid invoice cannot be cancelled. Issue a credit note instead.' }); return;
            }
            const project = await resolveProject(db, document);
            const eventRef = db.collection('billing_events').doc(`${documentId}_invoice_cancelled`);
            const note = safeNote(req.body?.note);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, cancelledByUid: identity.uid, customerId, projectId: project?.id || '', createdAt: timestamp });
                transaction.update(documentRef, {
                    status: 'Cancelled',
                    raw: { ...(document.raw || {}), status: 'Cancelled' },
                    billingWorkflowStatus: 'Invoice Cancelled',
                    billingWorkflowUpdatedAt: timestamp,
                    billingStage: 'invoice_cancelled',
                    invoiceCancelledAt: timestamp,
                    invoiceCancelledByUid: identity.uid,
                    invoiceCancelledByName: caller?.name || identity.email || '',
                    invoiceCancelledNote: note
                });
                recordTimelineInTransaction(db, transaction, {
                    documentId, document, project, customer,
                    stage: 'invoice_cancelled',
                    fromStatus: document.status || 'Unpaid',
                    toStatus: 'Cancelled',
                    note,
                    timestamp,
                    ...actor
                });
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            const recipients = [customer?.clientEmail, ...(Array.isArray(customer?.additionalClientEmails) ? customer.additionalClientEmails : []), project?.ownerEmail];
            const count = await createPortalNotifications(db, recipients, {
                title: `Invoice cancelled — ${document.docNo}`,
                message: `${document.docNo} has been cancelled and no payment is due.${note ? ` Note: ${note}` : ''}`,
                actionLabel: 'OPEN BILLING'
            });
            res.status(200).json({ success: true, recipients: count }); return;
        }

        if (action === 'payment-proof-reviewed') {
            const allowedReviewer = PAYMENT_REVIEW_ROLES.has(callerRole) ||
                INVOICE_MANAGEMENT_ROLES.has(callerRole) ||
                await callerIsProjectPic(db, document, identity.email);
            if (!allowedReviewer) {
                res.status(403).json({ error: 'Only the assigned PIC, HR Management, Finance, Director or Superadmin may verify a payment proof.' }); return;
            }
            if (!document.paymentProofUrl || !['Submitted', 'Rejected'].includes(document.paymentProofReviewStatus || 'Submitted')) {
                res.status(409).json({ error: 'No submitted payment proof is awaiting review.' }); return;
            }
            // The exact Client ID / assigned-project match is enforced where a record is
            // first created or sent (quotation-issued, quotation-accepted, invoice-sent) —
            // those steps establish the link. Reviewing a payment proof never creates a
            // new link, so an older invoice whose project has since been renamed, moved
            // or removed must still be reviewable; its payment history is real either way.
            // Project/customer are resolved on a best-effort basis, used only to route
            // notifications, stamp the PIC and label the timeline entry — never to block
            // the review itself.
            const project = await resolveProject(db, document);
            const approved = req.body?.decision === 'approved';
            const note = safeNote(req.body?.note);
            const previousStatus = document.status;
            const nextStatus = approved ? 'Paid' : 'Unpaid';
            const raw = { ...(document.raw || {}), status: nextStatus };
            const reviewVersion = document.paymentProofAt || timestamp;
            const eventRef = db.collection('billing_events').doc(`${documentId}_review_${String(reviewVersion).replace(/[^a-zA-Z0-9]/g, '')}`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, {
                    action,
                    documentId,
                    customerId: customerId || document.billingClientId || '',
                    projectId: project?.id || document.billingProjectId || '',
                    reviewedByUid: identity.uid,
                    reviewedByName: caller?.name || identity.email,
                    decision: approved ? 'approved' : 'rejected',
                    originalStatus: previousStatus,
                    newStatus: nextStatus,
                    paymentProofUrl: document.paymentProofUrl || '',
                    note,
                    createdAt: timestamp
                });
                transaction.update(documentRef, {
                    status: nextStatus,
                    raw,
                    paymentProofReviewStatus: approved ? 'Verified' : 'Rejected',
                    paymentProofReviewedAt: timestamp,
                    paymentProofReviewedByUid: identity.uid,
                    paymentProofReviewedByName: caller?.name || identity.email,
                    paymentProofReviewNote: note,
                    billingWorkflowStatus: approved ? 'Paid' : 'Payment Proof Rejected',
                    billingWorkflowUpdatedAt: timestamp,
                    billingStage: approved ? 'paid' : 'payment_proof_rejected',
                    // Only overwrite the linkage stamps when this review actually resolved a
                    // current project — never blank out or guess at a historical record's link.
                    ...(project ? { billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) } : {})
                });
                // An approval is two facts as well: a person verified the proof,
                // and only then did the invoice become Paid. Keeping them apart is
                // what shows the settlement was never automatic.
                if (approved) {
                    recordTimelineInTransaction(db, transaction, {
                        documentId, document, project, customer,
                        stage: 'payment_verified',
                        version: reviewVersion,
                        fromStatus: previousStatus || 'Unpaid',
                        toStatus: previousStatus || 'Unpaid',
                        note,
                        timestamp,
                        ...actor,
                        extra: {
                            paymentProofUrl: document.paymentProofUrl || '',
                            paymentProofName: document.paymentProofName || '',
                            verifiedByUid: identity.uid,
                            verifiedByName: caller?.name || identity.email || '',
                            verifiedByEmail: normalizeEmail(identity.email) || ''
                        }
                    });
                    recordTimelineInTransaction(db, transaction, {
                        documentId, document, project, customer,
                        stage: 'paid',
                        version: reviewVersion,
                        fromStatus: previousStatus || 'Unpaid',
                        toStatus: 'Paid',
                        timestamp,
                        ...actor,
                        extra: {
                            verifiedByUid: identity.uid,
                            verifiedByName: caller?.name || identity.email || ''
                        }
                    });
                } else {
                    recordTimelineInTransaction(db, transaction, {
                        documentId, document, project, customer,
                        stage: 'payment_proof_rejected',
                        version: reviewVersion,
                        fromStatus: previousStatus || 'Unpaid',
                        toStatus: 'Unpaid',
                        note,
                        timestamp,
                        ...actor,
                        extra: {
                            paymentProofUrl: document.paymentProofUrl || '',
                            paymentProofName: document.paymentProofName || '',
                            verifiedByUid: identity.uid,
                            verifiedByName: caller?.name || identity.email || ''
                        }
                    });
                }
                return true;
            });
            if (!created) { res.status(200).json({ success: true, duplicate: true }); return; }
            const recipients = [customer?.clientEmail, ...(Array.isArray(customer?.additionalClientEmails) ? customer.additionalClientEmails : []), project?.ownerEmail, ...(await recipientsForRoles(db, ['Director', 'Superadmin']))];
            const count = await createPortalNotifications(db, recipients, {
                title: approved ? `Payment verified — ${document.docNo}` : `Payment proof needs attention — ${document.docNo}`,
                message: approved
                    ? `Finance verified the payment proof for ${document.docNo}. The invoice is now marked Paid.`
                    : `Finance could not verify the payment proof for ${document.docNo}.${note ? ` Note: ${note}` : ' Please upload a corrected proof.'}`,
                actionLabel: approved ? 'VIEW RECEIPT' : 'UPLOAD PROOF'
            });
            res.status(200).json({ success: true, approved, recipients: count }); return;
        }

        res.status(400).json({ error: 'Unsupported workflow action.' });
    } catch (error) {
        console.error('billing-workflow error:', error);
        res.status(500).json({ error: 'Unable to complete this billing workflow right now.' });
    }
};
