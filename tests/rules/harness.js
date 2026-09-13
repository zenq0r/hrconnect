// Runs firestore.rules and storage.rules exactly as deployed, in the Firebase
// emulator, against the accounts each flow of the portal actually uses.
//
// The tests in tests/*.test.js read source text. These do not: every write
// below is sent to the rules engine and allowed or refused by it. Run them with
// `npm run test:rules`, which starts the emulators, runs this folder and stops
// them again. They need Java, which the emulators are built on.

const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const ROOT = path.join(__dirname, '..', '..');
const PROJECT_ID = 'demo-hrconnect';

// Every session the tests sign in as. The auth_time is the moment Firebase
// accepted the password; sfa is the second-factor stamp that sign-in's code
// sets for the roles that must clear one.
const SIGNED_IN_AT = 1789300000;
const ACCOUNTS = {
    superadmin: { uid: 'u-superadmin', email: 'root@zenqor.com.my', role: 'Superadmin', name: 'ROOT ADMIN' },
    director: { uid: 'u-director', email: 'director@zenqor.com.my', role: 'Director', name: 'DIRECTOR' },
    hr: { uid: 'u-hr', email: 'hr@zenqor.com.my', role: 'HR', name: 'HR OFFICER' },
    account: { uid: 'u-account', email: 'finance@zenqor.com.my', role: 'Account', name: 'FINANCE' },
    it: { uid: 'u-it', email: 'it@zenqor.com.my', role: 'IT', name: 'IT OFFICER' },
    staff: { uid: 'u-staff', email: 'staff@zenqor.com.my', role: 'Staff', name: 'PIC STAFF' },
    otherStaff: { uid: 'u-staff2', email: 'other@zenqor.com.my', role: 'Staff', name: 'OTHER STAFF' },
    client: { uid: 'u-client', email: 'buyer@clientco.com', role: 'Client', name: 'CLIENT BUYER', clientDirectoryId: 'CUST-1' },
    otherClient: { uid: 'u-client2', email: 'someone@elsewhere.com', role: 'Client', name: 'OTHER CLIENT', clientDirectoryId: 'CUST-2' },
};
const SECOND_FACTOR_ROLES = ['Superadmin', 'Director', 'Account'];

let env;

async function start() {
    env = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8085 },
        storage: { rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'), host: '127.0.0.1', port: 9199 },
    });
    return env;
}

async function stop() {
    if (env) await env.cleanup();
}

async function reset() {
    await env.clearFirestore();
    await seed({
        ...Object.fromEntries(Object.values(ACCOUNTS).map(a => [`users/${a.uid}`, {
            email: a.email, role: a.role, name: a.name, ...(a.clientDirectoryId ? { clientDirectoryId: a.clientDirectoryId } : {}),
        }])),
    });
}

// Writes documents with the rules switched off: the state a flow starts from.
async function seed(documents) {
    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const [docPath, data] of Object.entries(documents)) await db.doc(docPath).set(data);
    });
}

// A signed-in session. By default a role that must clear the second factor has
// cleared it for this sign-in; pass { secondFactor: false } for one that has
// not, or { secondFactorAt } for a stamp left over from an earlier sign-in.
function as(name, { secondFactor = true, secondFactorAt } = {}) {
    const account = ACCOUNTS[name];
    const claims = {
        email: account.email,
        email_verified: true,
        auth_time: SIGNED_IN_AT,
        role: account.role,
        ...(account.clientDirectoryId ? { clientDirectoryId: account.clientDirectoryId } : {}),
    };
    if (SECOND_FACTOR_ROLES.includes(account.role) && (secondFactor || secondFactorAt)) {
        claims.sfa = secondFactorAt ?? SIGNED_IN_AT;
    }
    const context = env.authenticatedContext(account.uid, claims);
    return { db: context.firestore(), storage: context.storage(), account };
}

function anonymous() {
    const context = env.unauthenticatedContext();
    return { db: context.firestore(), storage: context.storage() };
}

module.exports = { start, stop, reset, seed, as, anonymous, ACCOUNTS, SIGNED_IN_AT, assertFails, assertSucceeds };
