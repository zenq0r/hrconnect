// Server-authoritative bridge for Client billing actions. The browser may state
// that a quotation was accepted or a proof was uploaded, but only this handler
// decides who receives the internal handover and what the next workflow state is.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { normalizeEmail, isSeedAdminEmail, PORTAL_URL } = require('./_security');
const { enforceRateLimit } = require('./_rateLimit');
const { secondFactorSatisfied } = require('./_portalClaims');

const INVOICE_MANAGEMENT_ROLES = new Set(['Director', 'Superadmin']);
const PAYMENT_REVIEW_ROLES = new Set(['HR', 'Account']);
// Quotation publishing can be performed by the document team. Invoice issuing
// remains restricted to the full-access roles above.
const DOCUMENT_ISSUE_ROLES = new Set(['Director', 'Superadmin', 'HR', 'Account']);

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
        if (!['quotation-issued', 'quotation-accepted', 'invoice-sent', 'payment-proof-submitted', 'payment-proof-reviewed'].includes(action) || typeof documentId !== 'string' || !documentId) {
            res.status(400).json({ error: 'Invalid workflow request.' }); return;
        }
        const rate = await enforceRateLimit(db, { scope: 'billing-workflow', key: identity.uid, limit: 20, windowMs: 5 * 60 * 1000 });
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
                    billingClientId: customerId,
                    billingProjectId: project.id,
                    billingPicEmail: normalizeEmail(project.ownerEmail)
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
                transaction.update(documentRef, { billingWorkflowStatus: 'Awaiting Finance Invoice', billingWorkflowUpdatedAt: timestamp, billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) });
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
                transaction.update(documentRef, { paymentProofReviewStatus: 'Submitted', billingWorkflowStatus: 'Payment Proof Review', billingWorkflowUpdatedAt: timestamp, billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) });
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
            const eventRef = db.collection('billing_events').doc(`${documentId}_invoice_sent`);
            const created = await db.runTransaction(async (transaction) => {
                if ((await transaction.get(eventRef)).exists) return false;
                transaction.create(eventRef, { action, documentId, sentByUid: identity.uid, customerId, projectId: project.id, createdAt: timestamp });
                transaction.update(documentRef, { billingWorkflowStatus: 'Sent to Client', invoiceSentAt: timestamp, invoiceSentByUid: identity.uid, invoiceSentByName: caller?.name || identity.email, billingClientId: customerId, billingProjectId: project.id, billingPicEmail: normalizeEmail(project.ownerEmail) });
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
            const project = await resolveProject(db, document);
            if (!customer || !project) {
                res.status(409).json({ error: 'The invoice Client ID and assigned project do not match. Payment proof cannot be reviewed.' }); return;
            }
            const approved = req.body?.decision === 'approved';
            const note = safeNote(req.body?.note);
            const nextStatus = approved ? 'Paid' : 'Unpaid';
            const raw = { ...(document.raw || {}), status: nextStatus };
            await documentRef.update({
                status: nextStatus,
                raw,
                paymentProofReviewStatus: approved ? 'Verified' : 'Rejected',
                paymentProofReviewedAt: timestamp,
                paymentProofReviewedByUid: identity.uid,
                paymentProofReviewedByName: caller?.name || identity.email,
                paymentProofReviewNote: note,
                billingWorkflowStatus: approved ? 'Paid' : 'Payment Proof Rejected',
                billingWorkflowUpdatedAt: timestamp,
                billingClientId: customerId,
                billingProjectId: project.id,
                billingPicEmail: normalizeEmail(project.ownerEmail)
            });
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
