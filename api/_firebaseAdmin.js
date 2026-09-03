const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');

function getAdminApp() {
    // firebase-admin v14 removed the legacy `admin.apps` namespace export.
    // getApps() is the supported registry API and works on the v12-v14 upgrade
    // path, keeping every serverless route on one initialized Admin app.
    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(raw);
        } catch (_) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY must contain valid JSON.');
        }
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    return admin;
}

module.exports = { getAdminApp };
