// Admin actions on somebody else's portal account: lock, unlock, delete.
//
// One route rather than three because all three are the same request wearing
// different verbs — verify the caller, confirm they are Superadmin/Director and
// not themselves locked, refuse the protected seed account, refuse acting on
// oneself, then do the Admin SDK work the browser cannot. They also shared an
// error-triage block that had already been copy-pasted once. On the Hobby plan
// every route counts against a per-deployment function ceiling, so folding them
// together buys back headroom that a genuinely new capability can spend later.
//
// LOCK has to reach three places, and closing only the first would be a lock in
// name only:
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
// cryptographically valid until it expires (one hour at the outside, usually far
// less because the SDK refreshes on its own). Security Rules validate signature
// and expiry, not revocation. Steps 2 and 3 mean the refresh that follows
// returns nothing usable, so the exposure is bounded rather than lasting until
// somebody notices. Step 1 closes Firestore immediately.
//
// DELETE removes the Firebase Authentication account, which the client SDK can
// never do for another user — it can only delete the currently signed-in one.
// app.js calls this first and removes the users/{uid} Firestore record after, so
// access is revoked even if the Firestore cleanup then fails; retrying just
// cleans up the leftover document, since an already-deleted Auth account is
// reported here as success rather than as an error.
//
// The actor is always stamped from the verified token, never from the body —
// accessLockedBy is the field an audit reads first.
const { getAdminAuth, getAdminFirestore } = require('./_firebaseAdmin');
const { isSeedAdminEmail } = require('./_security');
const { buildPortalClaims } = require('./_portalClaims');

const ACTIONS = ['lock', 'unlock', 'delete'];

// What the person pressing the button sees when the deployment itself is
// misconfigured. The exact cause — which environment variable, and how it is
// broken — is written to the function log below, where whoever can fix it will
// look. It used to be sent to the browser verbatim: a redeploy instruction and
// the name of the variable holding the service-account key, shown to anyone
// who happened to press Lock that day.
const SERVER_CREDENTIALS_MESSAGE =
    'Account changes are unavailable because the server credentials are not set up correctly. ' +
    'Ask whoever manages the portal deployment to check its function logs.';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { action } = req.body || {};
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
            res.status(403).json({ error: 'Only Superadmin or Director may change a portal account.' });
            return;
        }
        // A locked administrator does not get to keep administering. This was on
        // the lock path only before these two routes were folded together; the
        // Admin SDK bypasses firestore.rules, so without it here a locked admin
        // could still delete other people's accounts through this endpoint.
        if (callerDoc.exists && callerDoc.data().accessLocked === true) {
            res.status(403).json({ error: 'Your own portal access is locked.' });
            return;
        }

        const { uid, reason } = req.body || {};
        if (!ACTIONS.includes(action)) { res.status(400).json({ error: `An action is required, one of: ${ACTIONS.join(', ')}.` }); return; }
        if (typeof uid !== 'string' || !uid) { res.status(400).json({ error: 'No portal account was selected.' }); return; }
        // Both re-checked server-side. The UI already withholds Lock and Delete
        // on the viewer's own row, but that withholding is not itself a security
        // boundary. Unlocking yourself is not refused because it is not
        // reachable — a locked account cannot sign in to ask.
        if (uid === decoded.uid && action !== 'unlock') {
            res.status(400).json({ error: `You cannot ${action} your own account.` });
            return;
        }

        if (action === 'delete') {
            let targetAuthUser;
            try {
                targetAuthUser = await auth.getUser(uid);
            } catch (lookupError) {
                if (lookupError.code === 'auth/user-not-found') {
                    // The Firestore record was already removed and this is a retry, or
                    // the Auth account was cleaned up some other way — report success so
                    // the caller is not stuck on a non-actionable error.
                    res.status(200).json({ success: true, alreadyDeleted: true });
                    return;
                }
                throw lookupError;
            }
            if (isSeedAdminEmail(targetAuthUser.email)) {
                res.status(403).json({ error: 'The protected seed admin account cannot be deleted.' });
                return;
            }
            await auth.deleteUser(uid);
            res.status(200).json({ success: true });
            return;
        }

        const locked = action === 'lock';
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
        console.error('portal-account error:', error);
        const code = error?.code || '';
        const message = error?.message || '';
        // One 500 for every cause left the operator with nothing to act on: a
        // missing service-account key and a transient Firebase outage read
        // identically, though only one of them is fixable from here.
        if (/FIREBASE_SERVICE_ACCOUNT_KEY.*not set/.test(message)) {
            console.error('portal-account: FIREBASE_SERVICE_ACCOUNT_KEY is not present on this deployment. Add it, then redeploy so the build picks it up.');
            res.status(503).json({ error: SERVER_CREDENTIALS_MESSAGE });
            return;
        }
        if (/FIREBASE_SERVICE_ACCOUNT_KEY.*valid JSON/.test(message)) {
            console.error('portal-account: FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON. Re-paste the whole service account file, including its outer braces.');
            res.status(503).json({ error: SERVER_CREDENTIALS_MESSAGE });
            return;
        }
        if (/PEM|DECODER|private key/i.test(message)) {
            console.error('portal-account: FIREBASE_SERVICE_ACCOUNT_KEY parsed but its private key was rejected — the newline escapes were probably altered. Re-add the file unmodified.');
            res.status(503).json({ error: SERVER_CREDENTIALS_MESSAGE });
            return;
        }
        if (code.startsWith('auth/id-token') || code === 'auth/argument-error') {
            res.status(401).json({ error: 'Your session token was rejected. Sign out, sign in again, then retry.' });
            return;
        }
        if (code === 'auth/user-not-found') {
            res.status(404).json({ error: 'That sign-in account no longer exists.' });
            return;
        }
        if (code === 'auth/insufficient-permission') {
            console.error('portal-account: the service account lacks permission to change Authentication accounts.');
            res.status(500).json({ error: 'The server is not permitted to change sign-in accounts. Ask whoever manages the portal deployment to check its credentials.' });
            return;
        }
        if (action === 'delete') {
            res.status(500).json({ error: `The sign-in account could not be deleted${code ? ` (${code})` : ''}. Nothing was removed.` });
            return;
        }
        // Deliberately does not promise nothing changed — something may well
        // have. The ordering above guarantees only that whatever did apply is
        // the restrictive half, and that retrying is safe because every step is
        // idempotent.
        res.status(500).json({ error: `The change did not finish applying${code ? ` (${code})` : ''}. The account is left in the more restricted state, not a half-open one. Retry to complete it.` });
    }
};
