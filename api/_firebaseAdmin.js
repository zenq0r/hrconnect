const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

function getAdminApp() {
    // firebase-admin v14 exports app, Auth and Firestore APIs from their
    // dedicated modules. The previous namespace-style service access was
    // removed, so keep the initialized app as the single shared
    // foundation and expose its services through the helpers below.
    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(raw);
        } catch (_) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY must contain valid JSON.');
        }
        initializeApp({ credential: cert(serviceAccount) });
    }
    return getApp();
}

function getAdminAuth() {
    return getAuth(getAdminApp());
}

function getAdminFirestore() {
    return getFirestore(getAdminApp());
}

module.exports = { getAdminApp, getAdminAuth, getAdminFirestore, Timestamp };
