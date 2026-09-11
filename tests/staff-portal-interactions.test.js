const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { readSource, methodSource, constantSource } = require('./helpers/sources');

const read = name => readSource(name);
const appSource = () => read('app.js');
const markup = () => read('index.html');
const rules = () => read('firestore.rules');

// Rebuild the Staff Portal's gates out of app.js with a stub `this`, so these
// exercise the shipped logic rather than a paraphrase of it - the same
// technique tests/admin-full-access.test.js uses for the module gates.
function buildStaffPortal(role, { uid = 'viewer-uid' } = {}) {
    const portal = new Function(`
        ${constantSource('RBAC_ROLES', 'MODULE_LABELS', 'FULL_ACCESS_ROLES', 'STAFF_PORTAL_OBSERVER_ROLES', 'STAFF_PORTAL_ACTIONS')}
        return { ${methodSource('isAccountLocked', 'staffPortalStatusBadge', 'isStaffPortalActionAvailable', 'staffPortalActionsFor')} };
    `)();
    portal.userProfile = { role, uid };
    portal.canManageStaffPortal = FULL_ACCESS.includes(role);
    portal.canObserveStaffPortal = FULL_ACCESS.includes(role) || OBSERVERS.includes(role);
    portal.isSeedAdminEmail = email => SEED_ADMINS.includes(String(email || '').toLowerCase());
    portal.isPortalUserOnline = () => false;
    portal.showNotify = () => {};
    return portal;
}

const FULL_ACCESS = ['Superadmin', 'Director'];
const OBSERVERS = ['IT'];
const SEED_ADMINS = ['info@zenqor.com.my', 'admin@zenq0r.com'];
const READ_ONLY_ACTIONS = ['view', 'read', 'access'];
const WRITING_ACTIONS = ['edit', 'lock', 'reset', 'delete'];

test('the Staff Portal offers every named interaction, and the row buttons are built from that one list', () => {
    const src = appSource();
    const list = constantSource('STAFF_PORTAL_ACTIONS');
    for (const key of [...READ_ONLY_ACTIONS, ...WRITING_ACTIONS]) {
        assert.match(list, new RegExp(`key: '${key}'`), `the ${key} interaction must exist`);
    }
    // Accept and Reject act on a request rather than on an account, so they are
    // a separate list - but they must exist just the same.
    const decisions = constantSource('STAFF_PORTAL_REQUEST_ACTIONS');
    assert.match(decisions, /key: 'accept'/);
    assert.match(decisions, /key: 'reject'/);

    // One source for the buttons, the right-click menu and the gate. If the
    // markup ever hardcodes a button again, the two can drift apart.
    assert.match(markup(), /v-for="action in staffPortalActionsFor\(usr\)"/);
    assert.match(markup(), /v-for="action in staffPortalRequestActions\(\)"/);
    assert.match(src, /portalUserRowMenuItems\(usr\) \{\s*return this\.staffPortalActionsFor\(usr\)/);
});

test('full access is Superadmin and Director; an observer gets the read-only three and nothing else', () => {
    for (const role of FULL_ACCESS) {
        const portal = buildStaffPortal(role);
        const offered = portal.staffPortalActionsFor({ id: 'someone', email: 'person@zenqor.com.my', role: 'Staff' }).map(a => a.key);
        assert.deepEqual(offered, [...READ_ONLY_ACTIONS, ...WRITING_ACTIONS], `${role} must be offered every interaction, in order`);
    }

    const observer = buildStaffPortal('IT');
    const offered = observer.staffPortalActionsFor({ id: 'someone', email: 'person@zenqor.com.my', role: 'Staff' }).map(a => a.key);
    assert.deepEqual(offered, READ_ONLY_ACTIONS);
    for (const key of WRITING_ACTIONS) {
        assert.equal(observer.isStaffPortalActionAvailable(key, { id: 'someone', email: 'person@zenqor.com.my' }), false, `IT must not hold ${key}`);
    }
});

test('a role with no Staff Portal standing is offered nothing at all', () => {
    for (const role of ['HR', 'Account', 'Staff', 'Client']) {
        const portal = buildStaffPortal(role);
        assert.deepEqual(portal.staffPortalActionsFor({ id: 'someone', email: 'person@zenqor.com.my' }), []);
    }
});

test('the seed administrator and the viewer themselves are protected from lock-out', () => {
    const admin = buildStaffPortal('Superadmin', { uid: 'me' });

    // Nothing that writes is offered on the bootstrap account.
    const onSeed = admin.staffPortalActionsFor({ id: 'seed', email: 'info@zenqor.com.my', role: 'Superadmin' }).map(a => a.key);
    assert.deepEqual(onSeed, READ_ONLY_ACTIONS);

    // Lock and Delete are withheld on one's own row - both are self-lockout.
    const onSelf = admin.staffPortalActionsFor({ id: 'me', email: 'me@zenqor.com.my', role: 'Superadmin' }).map(a => a.key);
    assert.ok(!onSelf.includes('lock'), 'an admin must not be able to lock themselves out');
    assert.ok(!onSelf.includes('delete'), 'an admin must not be able to delete their own access');
    assert.ok(onSelf.includes('edit'), 'editing one\'s own record stays available');
});

test('Lock reads Unlock once the account is locked, and says so in the roster', () => {
    const admin = buildStaffPortal('Director');
    const locked = { id: 'someone', email: 'person@zenqor.com.my', accessLocked: true };
    const lockAction = admin.staffPortalActionsFor(locked).find(action => action.key === 'lock');
    assert.equal(lockAction.label, 'Unlock');
    assert.equal(admin.staffPortalStatusBadge(locked).label, 'Locked');
    assert.equal(admin.staffPortalStatusBadge({ id: 'x', email: 'a@zenqor.com.my' }).label, 'Active');
});

test('every writing interaction re-checks the gate in the method, not only in the markup', () => {
    const src = appSource();
    // The right-click menu, a stale render and the console all reach these.
    assert.match(src, /runStaffPortalAction\(actionKey, usr\) \{\s*if \(!this\.isStaffPortalActionAvailable\(actionKey, usr\)\)/);
    assert.match(src, /async toggleStaffPortalLock\(usr\) \{\s*if \(!this\.isStaffPortalActionAvailable\('lock', usr\)\)/);
    assert.match(src, /async requireStaffPortalPasswordChange\(usr\) \{\s*if \(!this\.isStaffPortalActionAvailable\('reset', usr\)\)/);
    assert.match(src, /async decideAccessRequest\(request, decision\) \{\s*if \(!this\.canManageStaffPortal\)/);
});

test('a locked account is refused at every way into the portal', () => {
    const src = appSource();
    // Interactive sign-in and restored session both consult the same helper.
    assert.equal((src.match(/accountLockedSignInMessage\(userData, firebaseUser\.email\)/g) || []).length, 2);
    // A session locked while it is open ends too - but only after the lock is
    // confirmed against the server, same discipline as a revocation.
    assert.match(src, /async isPortalAccessTrulyLocked\(\)/);
    assert.match(src, /const snapshot = await getDocFromServer\(doc\(db, 'users', user\.uid\)\);\s*(\/\/[^\n]*\n\s*)*if \(!snapshot\.exists\(\)\) return '';/);
    assert.equal((src.match(/this\.revokePortalAccessIfLocked\(\)/g) || []).length, 2);
    // The bootstrap administrator is never locked out of its own portal.
    assert.match(src, /if \(this\.isSeedAdminEmail\(email\)\) return '';/);
});

test('the lock is enforced by the rules, not only by the interface', () => {
    const rulesSource = rules();
    assert.match(rulesSource, /function isAccessLocked\(\) \{/);
    // The role is only active when the record is not locked. Asserted on the
    // guarantee rather than on one spelling of it: the helpers now take the
    // already-fetched record as an argument so a role question costs one
    // document read instead of three.
    assert.match(rulesSource, /function recordHasActiveRole\(record, role\) \{\s*return record\.role == role && !recordIsLocked\(record\);/);
    assert.match(rulesSource, /function hasActiveRole\(role\) \{\s*return recordHasActiveRole\(getUserRecord\(\), role\);/);
    // One read per question, not three — a Client is checked last in every role
    // list, so it pays for every failed check ahead of it.
    assert.equal((rulesSource.match(/get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.auth\.uid\)\)/g) || []).length, 1,
        'the user record must be fetched from exactly one place');
    // Every role a rule can ask about resolves to false while the lock is on.
    for (const role of ['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff', 'Client']) {
        assert.match(rulesSource, new RegExp(`hasActiveRole\\('${role}'\\)`), `${role} must go through the lock check`);
    }
    // A locked account may still read its own record - that is how the portal
    // tells the person they are locked instead of "your access was removed".
    assert.match(rulesSource, /allow read: if isApprovedStaffSession\(\) \|\| \(isAuthenticated\(\) && request\.auth\.uid == userId\)/);
    // ...but it may not keep writing to it, presence pings included.
    assert.match(rulesSource, /request\.auth\.uid == userId &&\s*(\/\/[^\n]*\n\s*)*!isAccessLocked\(\)/);
});

test('an access request may only be raised for oneself, and only decided by full access', () => {
    const rulesSource = rules();
    const block = rulesSource.slice(rulesSource.indexOf('match /access_requests/{requestId}'), rulesSource.indexOf('match /employees/{empId}'));
    assert.ok(block.length > 0, 'access_requests rules must exist');
    assert.match(block, /request\.resource\.data\.requesterUid == request\.auth\.uid/);
    assert.match(block, /request\.resource\.data\.requesterEmail == request\.auth\.token\.email/);
    assert.match(block, /request\.resource\.data\.status == 'Pending'/);
    // A Client login belongs to a customer record, never to an internal request.
    assert.match(block, /request\.resource\.data\.requestedRole != 'Client'/);
    // Deciding is the only update, and it cannot rewrite who asked for what.
    assert.match(block, /allow update: if isAdmin\(\) &&/);
    assert.match(block, /request\.resource\.data\.requestedRole == resource\.data\.requestedRole/);
    assert.match(block, /request\.resource\.data\.status in \['Accepted', 'Rejected'\]/);
});

test('accepting a request applies the role the same way the Edit form does', () => {
    const src = appSource();
    const decide = src.slice(src.indexOf('async decideAccessRequest(request, decision)'), src.indexOf('backupDatabase() {'));
    assert.match(decide, /setDoc\(doc\(db, 'users', request\.requesterUid\), \{ role: request\.requestedRole \}, \{ merge: true \}\)/);
    // Storage Rules read the role off the Auth custom claims, which do not move
    // on their own - the manual role change syncs them and so must this.
    assert.match(decide, /await this\.syncUserClaims\(request\.requesterUid\)/);
    // A staff account cannot be accepted onto an email its role does not allow.
    assert.match(decide, /!this\.isPortalEmailAllowed\(request\.requesterEmail, request\.requestedRole\)/);
});

test('the roster and the request queue both render the interactions they gate', () => {
    const html = markup();
    assert.match(html, /v-if="canObserveStaffPortal"/);
    assert.match(html, /Staff Portal — Portal Access Management/);
    // Add Access is a writing action and must not appear for an observer.
    assert.match(html, /<button v-if="canManageStaffPortal" type="button" @click="openUserAccessModal\(\)"/);
    // The account drawer serves View, Read and Access.
    assert.match(html, /v-if="staffPortalAccount\.show"/);
    assert.match(html, /staffPortalAccount\.tab = 'overview'/);
    assert.match(html, /staffPortalAccount\.tab = 'activity'/);
    assert.match(html, /staffPortalAccount\.tab = 'access'/);
    // Raising a request is offered to the roles that are not already full access.
    assert.match(html, /v-if="canRequestAccessChange"/);
    assert.match(html, /@submit\.prevent="submitAccessRequest"/);
});

test('LOCK and UNLOCK are audited as themselves, not as a generic update', () => {
    const auditApi = read(path.join('api', 'audit-log.js'));
    assert.match(auditApi, /'UPLOAD_DOCUMENT', 'DELETE_DOCUMENT', 'LOCK', 'UNLOCK'/);
    assert.match(appSource(), /this\.logAudit\(locking \? 'LOCK' : 'UNLOCK'/);
});

test('a lock reaches Storage, not only Firestore', () => {
    const claims = read(path.join('api', '_portalClaims.js'));
    // storage.rules reads the role off the ID token, so a locked account must
    // carry no claims at all — otherwise the portal closes and client_documents
    // stays open, which is a lock in name only.
    assert.match(claims, /if \(accessLocked === true\) return \{\};/);

    // Both claim writers go through that one helper, so they cannot disagree
    // about what a locked account may carry.
    const sync = read(path.join('api', 'sync-user-claims.js'));
    assert.match(sync, /require\('\.\/_portalClaims'\)/);
    assert.match(sync, /buildPortalClaims\(db, \{ role, email, accessLocked: targetDoc\.data\(\)\.accessLocked \}\)/);
    assert.doesNotMatch(sync, /where\('clientEmail', '==', email\)/, 'the claim shape must live in one place only');
});

test('locking is a server action, and refuses what the interface refuses', () => {
    const endpoint = read(path.join('api', 'portal-account.js'));
    assert.match(endpoint, /\['Superadmin', 'Director'\]\.includes\(callerRole\)/);
    assert.match(endpoint, /callerDoc\.data\(\)\.accessLocked === true/, 'a locked admin must not keep locking others');
    // Lock and delete on one's own row are refused here, not merely hidden.
    assert.match(endpoint, /uid === decoded\.uid && action !== 'unlock'/, 'self-lock and self-delete must be refused server-side too');
    assert.match(endpoint, /isSeedAdminEmail\(targetData\.email\)/, 'the seed account must be refused server-side too');
    // The actor is taken from the verified token, never from the request body.
    assert.match(endpoint, /accessLockedBy: locked \? String\(decoded\.email \|\| ''\)/);
    // Auth: no new token can be minted for a locked account.
    assert.match(endpoint, /await auth\.revokeRefreshTokens\(uid\)/);
    assert.match(endpoint, /await auth\.updateUser\(uid, \{ disabled: locked \}\)/);

    // The browser calls it instead of writing the fields itself.
    const app = appSource();
    const toggle = app.slice(app.indexOf('async toggleStaffPortalLock(usr)'), app.indexOf('async requireStaffPortalPasswordChange(usr)'));
    assert.match(toggle, /fetch\('\/api\/portal-account'/);
    assert.match(toggle, /action: locking \? 'lock' : 'unlock'/);
    assert.doesNotMatch(toggle, /setDoc\(/, 'the lock fields must not be written straight from the browser');

    // Delete goes through the same route, on its own action.
    const remove = app.slice(app.indexOf('async deletePortalUser(uid, email)'), app.indexOf('backupDatabase() {'));
    assert.match(remove, /fetch\('\/api\/portal-account'/);
    assert.match(remove, /action: 'delete', uid/);
});

test('every admin action on somebody else\'s account is one route', () => {
    // The Hobby plan caps serverless functions per deployment, so a route added
    // per verb is a cost the project cannot keep paying. lock/unlock/delete
    // share every guard they need — caller role, caller not locked, seed
    // account, acting on oneself — so they share the route as well.
    const routes = fs.readdirSync(path.join(__dirname, '..', 'api'))
        .filter(name => name.endsWith('.js') && !name.startsWith('_'));
    assert.ok(routes.includes('portal-account.js'), 'the merged route must exist');
    assert.ok(!routes.includes('set-portal-lock.js'), 'the per-verb lock route must be gone');
    assert.ok(!routes.includes('delete-portal-user.js'), 'the per-verb delete route must be gone');

    const endpoint = read(path.join('api', 'portal-account.js'));
    assert.match(endpoint, /const ACTIONS = \['lock', 'unlock', 'delete'\];/);
    assert.match(endpoint, /if \(!ACTIONS\.includes\(action\)\)/, 'an unknown action must be refused');
    // Unlocking oneself is unreachable rather than dangerous; lock and delete
    // on one's own row are refused here as well as hidden in the interface.
    assert.match(endpoint, /uid === decoded\.uid && action !== 'unlock'/);

    // Nothing in the repo may still point at the retired routes.
    for (const file of ['app.js', path.join('api', '_portalClaims.js')]) {
        assert.doesNotMatch(read(file), /set-portal-lock|delete-portal-user/, `${file} still references a retired route`);
    }
});

test('the restrictive half is always the part left applied', () => {
    const endpoint = read(path.join('api', 'portal-account.js'));
    // No transaction spans Firestore, Storage claims and Auth, so the order is
    // chosen so a failure between them can only leave the account MORE closed.
    // Anchored on the lock/unlock branch specifically — delete returns its own
    // 200 earlier in the merged route, so a looser slice would come back empty.
    const ordering = endpoint.slice(
        endpoint.indexOf("const locked = action === 'lock';"),
        endpoint.indexOf('res.status(200).json({ success: true, locked, claims })')
    );
    assert.ok(ordering.length > 0, 'the lock/unlock branch must be findable');
    assert.match(ordering, /if \(locked\) \{\s*await writeAuth\(\);\s*await writeFirestore\(\);\s*\} else \{\s*await writeFirestore\(\);\s*await writeAuth\(\);\s*\}/);
});
