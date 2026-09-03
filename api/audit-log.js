const crypto = require('crypto');
const { getAdminAuth, getAdminFirestore, Timestamp } = require('./_firebaseAdmin');
const { getClientIp, parseUserAgent } = require('./_auditMetadata');
const { DEFAULT_RETENTION, retentionDurationMs } = require('./_auditRetention');
const { enforceRateLimit } = require('./_rateLimit');

// LOCK/UNLOCK are the Staff Portal's account-access actions. They are recorded
// as their own verbs rather than as a generic UPDATE: "who locked this account
// out, when, and why" is the first question asked of the log afterwards.
const ALLOWED_ACTIONS = new Set([
    'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'BACKUP',
    'UPLOAD_DOCUMENT', 'DELETE_DOCUMENT', 'LOCK', 'UNLOCK'
]);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ error: 'Missing authorization token.' }); return; }

        const auth = getAdminAuth();
        const db = getAdminFirestore();
        const decoded = await auth.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const rate = await enforceRateLimit(db, { scope: 'audit-log', key: decoded.uid, limit: 120, windowMs: 60 * 1000 });
        if (!rate.allowed) {
            res.setHeader('Retry-After', String(rate.retryAfterSeconds));
            res.status(429).json({ error: 'Audit event rate limit exceeded.' });
            return;
        }
        const { action, details, module } = req.body || {};
        const normalizedAction = String(action || '').trim().toUpperCase();
        if (!ALLOWED_ACTIONS.has(normalizedAction)) { res.status(400).json({ error: 'Invalid audit action.' }); return; }
        if (typeof details !== 'string' || !details.trim()) { res.status(400).json({ error: 'Audit details are required.' }); return; }

        const now = new Date();
        const retentionDoc = await db.collection('settings').doc('audit_retention').get();
        const retention = retentionDoc.exists ? retentionDoc.data() : DEFAULT_RETENTION;
        const expireAt = Timestamp.fromMillis(now.getTime() + retentionDurationMs(retention));
        const metadata = parseUserAgent(req.headers['user-agent']);
        const id = `${now.getTime()}-${crypto.randomUUID()}`;
        const auditRecord = {
            id,
            timestamp: now.toISOString(),
            user: decoded.email || userData.email || 'Unknown',
            userName: userData.name || decoded.name || '',
            uid: decoded.uid,
            role: userData.role || decoded.role || 'Unknown',
            action: normalizedAction,
            details: details.trim().slice(0, 1000),
            module: String(module || 'unknown').slice(0, 80),
            ip: getClientIp(req.headers),
            browser: metadata.browser,
            os: metadata.os,
            device: metadata.device,
            userAgent: metadata.userAgent,
            expireAt
        };

        await db.collection('audit_logs').doc(id).set(auditRecord);
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('audit-log error:', error);
        res.status(500).json({ error: 'Unable to record audit event.' });
    }
};
