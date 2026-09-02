// Deletes a Portal user's Firebase Authentication account. The client SDK can
// only ever delete the CURRENTLY signed-in user's own account, never another
// user's — so deletePortalUser() in app.js calls this Admin SDK endpoint
// after removing the users/{uid} Firestore record, closing the gap where a
// revoked portal user's Auth account (Identifier/Providers/Created/Signed
// In/User UID in the Firebase Console) would otherwise linger indefinitely.
const { getAdminApp } = require('./_firebaseAdmin');
const { isSeedAdminEmail } = require('./_security');

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
        if (!['Superadmin', 'Director'].includes(callerRole)) {
            res.status(403).json({ error: 'Only Superadmin or Director may delete a portal account.' });
            return;
        }

        const { uid } = req.body || {};
        if (typeof uid !== 'string' || !uid) { res.status(400).json({ error: 'A target user UID is required.' }); return; }
        if (uid === decoded.uid) { res.status(400).json({ error: 'You cannot delete your own account.' }); return; }

        // Re-check server-side — the UI already hides this action for the seed
        // account, but that hiding is not itself a security boundary.
        let targetAuthUser;
        try {
            targetAuthUser = await admin.auth().getUser(uid);
        } catch (lookupError) {
            if (lookupError.code === 'auth/user-not-found') {
                // Firestore record was already deleted and this is a retry / the Auth
                // account never existed (e.g. it was already cleaned up) — treat as
                // success so the caller doesn't get stuck on a non-actionable error.
                res.status(200).json({ success: true, alreadyDeleted: true });
                return;
            }
            throw lookupError;
        }
        if (isSeedAdminEmail(targetAuthUser.email)) {
            res.status(403).json({ error: 'The protected seed admin account cannot be deleted.' });
            return;
        }

        await admin.auth().deleteUser(uid);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('delete-portal-user error:', error);
        // One 500 for every cause left the operator with nothing to act on:
        // a missing service-account key and a transient Firebase outage read
        // identically, though only one of them is fixable from here.
        const code = error?.code || '';
        if (/FIREBASE_SERVICE_ACCOUNT_KEY/.test(error?.message || '')) {
            res.status(503).json({ error: 'Server is not configured to manage Firebase Authentication accounts. Set FIREBASE_SERVICE_ACCOUNT_KEY on the deployment and retry.' });
            return;
        }
        if (code.startsWith('auth/id-token') || code === 'auth/argument-error') {
            res.status(401).json({ error: 'Your session token was rejected. Sign out, sign in again, then retry.' });
            return;
        }
        if (code === 'auth/insufficient-permission') {
            res.status(500).json({ error: 'The service account lacks permission to delete Authentication accounts.' });
            return;
        }
        res.status(500).json({ error: `Firebase Authentication refused the delete${code ? ` (${code})` : ''}. The account was not removed.` });
    }
};
