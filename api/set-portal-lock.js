// Locks or unlocks a Staff Portal account.
//
// Why this is a server endpoint rather than a Firestore write from the browser:
// a lock has to reach three places the client SDK cannot touch, and closing only
// the first of them would be a lock in name only.
//
//   1. Firestore  — users/{uid}.accessLocked. firestore.rules resolves a locked
//                   session to no role (hasActiveRole), closing that service the
//                   instant the write lands. The browser could do this part.
//   2. Storage    — storage.rules reads the role from the ID token's custom
//                   claims, not from Firestore, so the Firestore flag alone
//                   leaves client_documents wide open. Clearing the claims is an
//                   Admin SDK operation.
//   3. Auth       — disabling the account and revoking its refresh tokens is
//                   what stops a new ID token being minted at all, so the lock
//                   survives the browser being told to ignore it.
//
// Honest limit: an ID token already in a locked user's hands stays
// cryptographically valid until it expires (one hour maximum, usually far less
// because the SDK refreshes on its own). Security Rules validate signature and
// expiry, not revocation. Steps 2 and 3 mean the refresh that follows returns
// nothing usable, so the exposure is bounded by that remaining lifetime rather
// than lasting until somebody notices. Step 1 closes Firestore immediately.
//
// Stamping the actor server-side (from the verified token, never from the body)
// keeps accessLockedBy honest — it is the field an audit reads first.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { isSeedAdminEmail } = require('./_security');
const { buildPortalClaims } = require('./_portalClaims');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) { res.status(401).json({ error: 'Missing authorization token.' }); return; }

        const auth = getAdminAuth();
        const db = getAdminFirestore();
        const decoded = await auth.verifyIdToken(idToken);

        const callerDoc = await db.collection('users').doc(decoded.uid).get();
        const callerRole = callerDoc.exists ? callerDoc.data().role : (isSeedAdminEmail(decoded.email) ? 'Superadmin' : null);
        if (!['Superadmin', 'Director'].includes(callerRole)) {
            res.status(403).json({ error: 'Only Superadmin or Director may lock a portal account.' });
            return;
        }
        // A locked administrator does not get to keep locking other people.
        if (callerDoc.exists && callerDoc.data().accessLocked === true) {
            res.status(403).json({ error: 'Your own portal access is locked.' });
            return;
        }

        const { uid, locked, reason } = req.body || {};
        if (typeof uid !== 'string' || !uid) { res.status(400).json({ error: 'A target user UID is required.' }); return; }
        if (typeof locked !== 'boolean') { res.status(400).json({ error: 'A locked state (true or false) is required.' }); return; }
        // Both re-checked server-side. The UI already withholds these two rows,
        // but that withholding is not itself a security boundary.
        if (locked && uid === decoded.uid) { res.status(400).json({ error: 'You cannot lock your own account.' }); return; }

        const targetRef = db.collection('users').doc(uid);
        const targetDoc = await targetRef.get();
        if (!targetDoc.exists) { res.status(404).json({ error: 'User record not found.' }); return; }
        const targetData = targetDoc.data();
        if (isSeedAdminEmail(targetData.email)) {
            res.status(403).json({ error: 'The protected seed admin account cannot be locked.' });
            return;
        }

        const now = new Date().toISOString();
        const lockReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';

        // Storage claims: a locked account carries none; unlocking rebuilds
        // exactly what sync-user-claims would have issued.
        const claims = await buildPortalClaims(db, {
            role: targetData.role || 'Staff',
            email: String(targetData.email || '').trim().toLowerCase(),
            accessLocked: locked
        });
        const writeFirestore = () => targetRef.set({
            accessLocked: locked,
            accessLockedAt: locked ? now : '',
            accessLockedBy: locked ? String(decoded.email || '').trim().toLowerCase() : '',
            accessLockReason: locked ? lockReason : ''
        }, { merge: true });
        const writeAuth = async () => {
            await auth.setCustomUserClaims(uid, claims);
            // Revoke before disabling so a refresh already in flight cannot slip
            // a fresh token out between the two calls.
            if (locked) await auth.revokeRefreshTokens(uid);
            await auth.updateUser(uid, { disabled: locked });
        };

        // These are separate services and there is no transaction across them,
        // so the order is chosen by which half-applied state is safe to be left
        // in. Whichever call fails, the restriction must be the part that is
        // already applied: LOCKING closes Auth and Storage first, so a failed
        // Firestore write leaves an account that cannot sign in at all (the
        // roster merely still shows it as Active until the retry). UNLOCKING
        // reverses that, so a failure leaves the account still locked rather
        // than half-open — Firestore refusing while Storage has its claims back.
        if (locked) {
            await writeAuth();
            await writeFirestore();
        } else {
            await writeFirestore();
            await writeAuth();
        }

        res.status(200).json({ success: true, locked, claims });
    } catch (error) {
        console.error('set-portal-lock error:', error);
        const code = error?.code || '';
        const message = error?.message || '';
        // Same triage as delete-portal-user: a missing service-account key and a
        // transient Firebase outage read identically without it, though only one
        // of them is fixable from here.
        if (/FIREBASE_SERVICE_ACCOUNT_KEY.*not set/.test(message)) {
            res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT_KEY is not present on this deployment. Add it, then redeploy so the build picks it up.' });
            return;
        }
        if (/FIREBASE_SERVICE_ACCOUNT_KEY.*valid JSON/.test(message)) {
            res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Re-paste the whole service account file, including its outer braces.' });
            return;
        }
        if (code.startsWith('auth/id-token') || code === 'auth/argument-error') {
            res.status(401).json({ error: 'Your session token was rejected. Sign out, sign in again, then retry.' });
            return;
        }
        if (code === 'auth/user-not-found') {
            res.status(404).json({ error: 'That Authentication account no longer exists.' });
            return;
        }
        if (code === 'auth/insufficient-permission') {
            res.status(500).json({ error: 'The service account lacks permission to change Authentication accounts.' });
            return;
        }
        // Deliberately does not promise nothing changed — something may well
        // have. The ordering above guarantees only that whatever did apply is
        // the restrictive half, and that retrying is safe because every step is
        // idempotent.
        res.status(500).json({ error: `The change did not finish applying${code ? ` (${code})` : ''}. The account is left in the more restricted state, not a half-open one. Retry to complete it.` });
    }
};
