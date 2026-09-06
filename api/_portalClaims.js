// The Firebase Auth custom claims a portal account carries.
//
// storage.rules reads `role` (and `clientDirectoryId` for a Client) straight off
// the ID token rather than calling firestore.get(), because that cross-service
// lookup does not work in this project. The claims are therefore the only thing
// standing between a signed-in session and the file bytes in Storage — which is
// why a LOCKED account is issued no claims at all: userRole() then matches
// nothing in any of storage.rules' role lists and every branch there denies.
// Without this a Staff Portal lock would close Firestore and leave Storage open.
//
// Shared by api/sync-user-claims.js (called after every sign-in and after a role
// change) and api/portal-account.js, so the two can never disagree about what a
// locked account is allowed to carry.
async function buildPortalClaims(db, { role, email, accessLocked }) {
    if (accessLocked === true) return {};

    const claims = { role };
    if (role === 'Client' && email) {
        // Query both fields and reject an ambiguous address. Picking the first
        // document would make the same login point at a different customer
        // depending on Firestore's result order.
        const primarySnap = await db.collection('customers')
            .where('clientEmail', '==', email).get();
        const additionalSnap = await db.collection('customers')
            .where('additionalClientEmails', 'array-contains', email).get();
        const matches = [...primarySnap.docs, ...additionalSnap.docs]
            .filter((doc, index, docs) => docs.findIndex(candidate => candidate.id === doc.id) === index);
        if (matches.length > 1) {
            const error = new Error('This email is registered to more than one Client Directory record. Ask an administrator to keep it on one record only.');
            error.code = 'client/email-ambiguous';
            throw error;
        }
        if (matches.length === 1) {
            claims.clientDirectoryId = matches[0].id;
        } else {
            const error = new Error('This email is not registered in the Client Directory. Ask an administrator to add it to the correct client record.');
            error.code = 'client/email-not-registered';
            throw error;
        }
    }
    return claims;
}

module.exports = { buildPortalClaims };
