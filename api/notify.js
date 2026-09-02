// Generic branded-email notifier for portal workflow events (claim/voucher
// submitted or decided, client document shared, project stage changed, client
// message sent). Requires a valid Firebase ID token so only signed-in portal
// users can trigger it. Recipients are restricted server-side to emails that
// actually belong to a provisioned staff user or a known client record —
// a signed-in caller cannot use this to relay mail to an arbitrary address.
const { getAdminApp } = require('./_firebaseAdmin');
const { isAllowedPortalUrl, normalizeEmail, isSeedAdminEmail } = require('./_security');
const { enforceRateLimit } = require('./_rateLimit');

const PORTAL_ROLES = new Set(['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff', 'Client']);

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildEmailHtml({ heading, message, ctaLabel, ctaUrl }) {
    const safeCtaUrl = isAllowedPortalUrl(ctaUrl) ? ctaUrl : null;
    const ctaBlock = safeCtaUrl ? `<div style="text-align: center; margin: 0 0 28px;">
      <a href="${safeCtaUrl}" style="display: inline-block; background-color: #14B8A6; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; padding: 15px 40px; border-radius: 10px;">${escapeHtml(ctaLabel || 'OPEN PORTAL')}</a>
    </div>` : '';
    return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 0; background-color: #ffffff; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden;">
  <div style="background-color: #0B1E36; padding: 28px 32px; text-align: center;">
    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">ZENQOR</span><span style="font-size: 20px; font-weight: 800; color: #14B8A6; letter-spacing: 0.5px;"> HRMS/CDTS</span>
  </div>
  <div style="padding: 36px 32px;">
    <h2 style="color: #0B1E36; font-size: 19px; margin: 0 0 20px; text-align: center;">${escapeHtml(heading)}</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 28px; white-space: pre-wrap;">${escapeHtml(message)}</p>
    ${ctaBlock}
  </div>
  <div style="background-color: #F8FAFC; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
    <p style="color: #94A3B8; font-size: 11px; margin: 0;">© ZENQOR HRMS/CDTS · Zenqor Technologies · This is an automated notification.</p>
  </div>
</div>`;
}

async function isAllowedRecipient(db, email, callerRole) {
    const lower = email.toLowerCase();
    const [byUserEmail, byClientEmail, byAdditionalClientEmail] = await Promise.all([
        db.collection('users').where('email', '==', lower).limit(1).get(),
        db.collection('customers').where('clientEmail', '==', lower).limit(1).get(),
        db.collection('customers').where('additionalClientEmails', 'array-contains', lower).limit(1).get()
    ]);
    if (callerRole === 'Client') {
        return !byUserEmail.empty && byUserEmail.docs.some(doc => doc.data().role !== 'Client');
    }
    return !byUserEmail.empty || !byClientEmail.empty || !byAdditionalClientEmail.empty;
}

// Website notifications are stored independently from a user's profile.  This
// avoids two browser sessions overwriting each other's notification log and lets
// Firestore deliver the alert immediately to a recipient who is already online.
async function createWebsiteNotifications(db, recipientEmails, notification) {
    const recipientUsers = new Map();
    const uniqueEmails = [...new Set(recipientEmails.map(email => email.toLowerCase()))];

    for (let index = 0; index < uniqueEmails.length; index += 10) {
        const batchEmails = uniqueEmails.slice(index, index + 10);
        const snapshot = await db.collection('users').where('email', 'in', batchEmails).get();
        snapshot.docs.forEach((userDoc) => {
            const user = userDoc.data();
            recipientUsers.set(userDoc.id, String(user.email || '').toLowerCase());
        });
    }

    if (!recipientUsers.size) return 0;

    const batch = db.batch();
    const timestamp = new Date().toISOString();
    recipientUsers.forEach((recipientEmail, recipientUid) => {
        const noticeRef = db.collection('portal_notifications').doc();
        batch.set(noticeRef, {
            recipientUid,
            recipientEmail,
            title: notification.heading,
            message: notification.message,
            actionLabel: notification.ctaLabel || 'OPEN PORTAL',
            actionUrl: isAllowedPortalUrl(notification.ctaUrl) ? notification.ctaUrl : 'https://www.hrct.portal.zenqor.com.my/',
            createdAt: timestamp,
            read: false
        });
    });
    await batch.commit();
    return recipientUsers.size;
}

// A client directory can authorize more than one contact.  Sending to the
// primary client address must therefore include every approved additional
// contact instead of leaving finance/operations users without the update.
async function expandAuthorizedClientRecipients(db, emails) {
    const expanded = new Set(emails);
    for (const email of emails) {
        const clients = await db.collection('customers').where('clientEmail', '==', email).limit(1).get();
        clients.docs.forEach((clientDoc) => {
            const additional = Array.isArray(clientDoc.data().additionalClientEmails)
                ? clientDoc.data().additionalClientEmails
                : [];
            additional.map(normalizeEmail).filter(Boolean).forEach(address => expanded.add(address));
        });
    }
    return [...expanded].slice(0, 20);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ error: 'Missing authorization token.' }); return; }

        const admin = getAdminApp();
        const decoded = await admin.auth().verifyIdToken(idToken);
        const db = admin.firestore();
        const callerDoc = await db.collection('users').doc(decoded.uid).get();
        const callerRole = callerDoc.exists ? callerDoc.data().role : (isSeedAdminEmail(decoded.email) ? 'Superadmin' : null);
        if (!PORTAL_ROLES.has(callerRole)) { res.status(403).json({ error: 'This account is not provisioned for notifications.' }); return; }

        const rate = await enforceRateLimit(db, { scope: 'notify', key: decoded.uid, limit: 15, windowMs: 5 * 60 * 1000 });
        if (!rate.allowed) {
            res.setHeader('Retry-After', String(rate.retryAfterSeconds));
            res.status(429).json({ error: 'Too many notification requests. Please try again shortly.' });
            return;
        }

        const { to, subject, heading, message, ctaLabel, ctaUrl } = req.body || {};
        const requestedRecipients = [...new Set((Array.isArray(to) ? to : [to]).map(normalizeEmail).filter(Boolean))].slice(0, 20);
        const candidates = await expandAuthorizedClientRecipients(db, requestedRecipients);
        if (!candidates.length) { res.status(400).json({ error: 'At least one valid recipient email is required.' }); return; }
        if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 ||
            typeof heading !== 'string' || !heading.trim() || heading.length > 160 ||
            typeof message !== 'string' || !message.trim() || message.length > 5000 ||
            (ctaLabel != null && (typeof ctaLabel !== 'string' || ctaLabel.length > 80))) {
            res.status(400).json({ error: 'Notification content is missing or exceeds the allowed length.' });
            return;
        }

        const knownChecks = await Promise.all(candidates.map(e => isAllowedRecipient(db, e, callerRole)));
        const recipients = candidates.filter((_, i) => knownChecks[i]);
        if (!recipients.length) { res.status(400).json({ error: 'No recipient matches a known staff or client account.' }); return; }

        // Always create the real-time website alert first.  An email-provider
        // outage must never hide a document or chat notification in the portal.
        const websiteRecipients = await createWebsiteNotifications(db, recipients, { heading, message, ctaLabel, ctaUrl });

        let emailStatus = 'unavailable';
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
            try {
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: 'Zenqor Support <support@zenqor.com.my>',
                        to: recipients,
                        subject: String(subject).slice(0, 200),
                        html: buildEmailHtml({ heading, message, ctaLabel, ctaUrl })
                    })
                });
                if (!response.ok) throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
                emailStatus = 'sent';
            } catch (emailError) {
                emailStatus = 'failed';
                console.error('Notification email failed after website notification was created:', emailError);
            }
        } else {
            console.error('RESEND_API_KEY is not configured; website notification was created without email delivery.');
        }

        res.status(200).json({ success: true, websiteRecipients, emailStatus });
    } catch (error) {
        console.error('notify error:', error);
        // Non-fatal by design: the caller (app.js) treats this as fire-and-forget
        // and never blocks the underlying workflow action on it.
        res.status(500).json({ error: 'Unable to send notification right now.' });
    }
};
