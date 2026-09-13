const { getAdminAuth, getAdminFirestore, Timestamp } = require('./_firebaseAdmin');
const { DEFAULT_RETENTION, normalizeRetention } = require('./_auditRetention');
const { secondFactorSatisfied } = require('./_portalClaims');

const ALLOWED_ROLES = new Set(['Superadmin', 'Director', 'IT']);

function eventTimestampMs(doc) {
    const data = doc.data();
    const parsed = Date.parse(data.timestamp || '');
    if (Number.isFinite(parsed)) return parsed;
    const idTimestamp = Number.parseInt(String(doc.id).split('-')[0], 10);
    return Number.isFinite(idTimestamp) ? idTimestamp : Date.now();
}

module.exports = async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ error: 'Missing authorization token.' }); return; }

        const auth = getAdminAuth();
        const db = getAdminFirestore();
        const decoded = await auth.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const role = userDoc.exists ? userDoc.data().role : null;
        if (!ALLOWED_ROLES.has(role)) { res.status(403).json({ error: 'Only Director, Superadmin, or IT may manage audit retention.' }); return; }
        if (!secondFactorSatisfied(decoded, role)) { res.status(403).json({ error: 'Confirm the sign-in code for this session first. Sign out, sign in again and enter the code sent to your email.' }); return; }

        const settingRef = db.collection('settings').doc('audit_retention');
        if (req.method === 'GET') {
            const settingDoc = await settingRef.get();
            const setting = settingDoc.exists ? settingDoc.data() : DEFAULT_RETENTION;
            res.status(200).json({ value: setting.value || DEFAULT_RETENTION.value, unit: setting.unit || DEFAULT_RETENTION.unit });
            return;
        }

        const retention = normalizeRetention(req.body?.value, req.body?.unit);
        if (!retention) { res.status(400).json({ error: 'Retention must be 1–999 hours, days, weeks, months, or years.' }); return; }

        const now = new Date().toISOString();
        await settingRef.set({
            value: retention.value,
            unit: retention.unit,
            updatedAt: now,
            updatedByUid: decoded.uid,
            updatedByEmail: decoded.email || ''
        }, { merge: true });

        const snapshot = await db.collection('audit_logs').get();
        let updated = 0;
        for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
            const batch = db.batch();
            const chunk = snapshot.docs.slice(offset, offset + 400);
            chunk.forEach(doc => {
                const expireAt = Timestamp.fromMillis(eventTimestampMs(doc) + retention.durationMs);
                batch.set(doc.ref, { expireAt }, { merge: true });
            });
            await batch.commit();
            updated += chunk.length;
        }

        res.status(200).json({ success: true, value: retention.value, unit: retention.unit, updatedRecords: updated });
    } catch (error) {
        console.error('audit-retention error:', error);
        res.status(500).json({ error: 'Unable to update audit retention settings.' });
    }
};
