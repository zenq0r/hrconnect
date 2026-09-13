// Firebase functions that run independently of the portal UI.
//
//   - cleanupDeletedAuthenticationUser: a direct deletion from the Firebase
//     Console cannot leave a stale portal profile behind in Firestore.
//   - verifyBillingDocumentTotals: the one money check firestore.rules cannot
//     make, because rules cannot add up a list.
const functions = require('firebase-functions/v1');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();

exports.cleanupDeletedAuthenticationUser = functions.auth.user().onDelete(async (user) => {
    await getFirestore().collection('users').doc(user.uid).delete();
    console.info('Removed Firestore portal profile after Authentication deletion.', { uid: user.uid });
});

// ---------------------------------------------------------------------------
// Billing totals
//
// firestore.rules already refuses a quotation or invoice whose SST is not 8% of
// its own subtotal, or whose grand total is not subtotal - discount + SST. What
// rules cannot do is add up the line items: the rules language has no way to
// iterate a list, so a document can still arrive with a subtotal that is
// internally consistent and yet has nothing to do with the lines printed on it.
//
// This closes that last gap from the other side. A write is not blocked — a
// trigger runs after the fact — but a wrong figure cannot survive: the document
// is corrected to what its own line items add up to, and the correction is
// recorded in the audit log where it will be seen.

const CENT = 0.01;
const SST_RATE = 0.08;

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function subtotalOf(items) {
    return money(items.reduce((sum, item) => sum + (Number(item?.qty) || 0) * (Number(item?.price) || 0), 0));
}

exports.verifyBillingDocumentTotals = functions.firestore
    .document('docs/{docId}')
    .onWrite(async (change, context) => {
        if (!change.after.exists) return null;
        const data = change.after.data() || {};

        // Documents filed before the totals were broken out carry no `subtotal`.
        // Their history is left exactly as it was recorded — this corrects what
        // the portal writes today, it does not rewrite the past.
        if (typeof data.subtotal !== 'number') return null;

        const items = data.raw && Array.isArray(data.raw.items) ? data.raw.items : null;
        if (!items || !items.length) return null;

        const subtotal = subtotalOf(items);
        const discount = money(data.discount);
        const sst = money(subtotal * SST_RATE);
        const amount = money(subtotal - discount + sst);

        const agrees = Math.abs(money(data.subtotal) - subtotal) <= CENT &&
            Math.abs(money(data.sst) - sst) <= CENT &&
            Math.abs(money(data.amount) - amount) <= CENT;
        // The correction below is itself a write, so this is also what stops the
        // trigger from calling itself for ever: the second pass agrees and ends.
        if (agrees) return null;

        const db = getFirestore();
        const docId = context.params.docId;
        const before = { subtotal: data.subtotal, sst: data.sst, amount: data.amount };

        await db.collection('docs').doc(docId).set({
            subtotal,
            sst,
            amount,
            totalsCorrectedAt: new Date().toISOString()
        }, { merge: true });

        // Written with the Admin SDK, the same way /api/audit-log writes one, so
        // it lands in the log the Audit & Security screen already reads. It is
        // kept for a year rather than for the retention setting, which defaults
        // to 30 days: a corrected figure is not routine traffic.
        const now = new Date();
        const id = `${now.getTime()}-billing-totals-${docId}`;
        await db.collection('audit_logs').doc(id).set({
            id,
            timestamp: now.toISOString(),
            user: 'system@zenqor.com.my',
            userName: 'Billing integrity check',
            uid: 'system',
            role: 'System',
            action: 'UPDATE',
            details: `${data.type || 'Document'} ${data.docNo || docId} was saved with totals that did not match its own line items ` +
                `(subtotal ${before.subtotal}, SST ${before.sst}, total ${before.amount}) and has been corrected to ` +
                `(subtotal ${subtotal}, SST ${sst}, total ${amount}).`,
            module: 'billing',
            ip: '',
            browser: '',
            os: '',
            device: 'server',
            userAgent: 'firebase-functions/verifyBillingDocumentTotals',
            expireAt: Timestamp.fromMillis(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        });

        console.warn('Corrected billing document totals.', { docId, before, after: { subtotal, sst, amount } });
        return null;
    });
