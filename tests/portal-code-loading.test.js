const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROOT } = require('./helpers/sources');

// The portal's code, not just its markup.
//
// app/portal.js is fetched with import() once a session is confirmed. Anything
// defined in the modules it imports does not exist on the component until then,
// so a single call to one of those methods from the sign-in page, from
// mounted(), or from the start of a sign-in is a TypeError in production — on
// the one path nobody can work around. These tests make that a failure here.

const METHOD_DEF = /^ {8}(?:async )?([A-Za-z_$][\w$]*)\s*\(/gm;
const readRoot = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
// A method named in a comment is not a call to it.
const codeOf = (file) => readRoot(file).replace(/^\s*\/\/.*$/gm, '');
const importsOf = (file) => [...readRoot(file).matchAll(/from "\.\/(?:app\/)?methods\/([\w-]+)\.js"/g)].map(m => m[1]);

function portalOnlyMethods() {
    const names = new Map();
    for (const group of importsOf('app/portal.js')) {
        for (const match of readRoot(`app/methods/${group}.js`).matchAll(METHOD_DEF)) names.set(match[1], group);
    }
    return names;
}

test('the sign-in page does not import the portal', () => {
    const portalGroups = importsOf('app/portal.js');
    const entryGroups = importsOf('app.js');
    const allGroups = fs.readdirSync(path.join(ROOT, 'app/methods')).map(f => f.replace('.js', '')).sort();

    assert.ok(portalGroups.length >= 10, 'app/portal.js should hold the bulk of the method groups');
    // Every group is loaded by exactly one of the two — never both, never neither.
    assert.deepEqual([...portalGroups, ...entryGroups].sort(), allGroups);

    // And nothing imports portal.js statically.
    for (const file of ['app.js', ...fs.readdirSync(path.join(ROOT, 'app/methods')).map(f => `app/methods/${f}`)]) {
        assert.doesNotMatch(readRoot(file), /^import[^;]*\/portal\.js"/m, `${file} must not import app/portal.js statically`);
    }
});

test('code arrives before the markup that calls it, and is bound like a declared method', () => {
    const shell = readRoot('app/methods/shell.js');
    assert.match(shell, /import\('\.\.\/portal\.js'\)/);
    // Bound, exactly as Vue binds `methods:` — a method passed on as a callback
    // would otherwise lose `this`.
    assert.match(shell, /this\[name\] = method\.bind\(this\);/);

    const views = shell.slice(shell.indexOf('async ensurePortalViews('));
    const codeAt = views.indexOf('await this.ensurePortalCode()');
    assert.ok(codeAt > -1 && codeAt < views.indexOf('await markup;'), 'code must be in before the markup is used');
});

test('nothing that runs before sign-in reaches a method that has not been fetched', () => {
    const portalOnly = portalOnlyMethods();

    // Every reference from an eagerly-loaded file to a portal-only method has
    // to be one of these, each for a stated reason. A new one fails this test
    // until somebody decides which side of the line it belongs on.
    const ALLOWED = {
        'app.js': {
            // Escape handler: each is behind `if (this.<modal>.show)`, and no
            // portal modal can be open before the portal has loaded.
            closeMarkProjectDoneModal: 'guarded', closeStaffPortalAccount: 'guarded', closeClientView: 'guarded',
            closeClientUpdateModal: 'guarded', closeWebsiteContentModal: 'guarded', closeSiteTextModal: 'guarded',
            closeActivityModal: 'guarded', closeProjectDetails: 'guarded', closeProjectModal: 'guarded',
            closeContextMenu: 'guarded', closeClientTaskModal: 'guarded',
            // Restored session: after ensurePortalViews(), checked below.
            initFirebaseRealtime: 'after-load',
            // unmounted(): behind `if (this.portalCodeLoaded)`.
            removeUniversalButtonContextMenu: 'guarded',
        },
        'app/methods/auth.js': {
            initFirebaseRealtime: 'after-load',   // completeLogin(), after ensurePortalViews()
            toOfficialUppercase: 'signed-in',     // saveMyProfile()
            prepareImageAttachment: 'signed-in',  // handleProfilePhotoUpload()
            getUploadErrorMessage: 'signed-in',   // handleProfilePhotoUpload()
        },
        'app/methods/forms.js': {
            // resetAllForms(): every sign-in calls it after ensurePortalViews().
            generateDocNo: 'after-load',
            autoCalculatePayroll: 'after-load',
        },
        'app/methods/presence.js': {
            syncAssignedProjectPresence: 'signed-in', // presence only runs inside a session
        },
        'app/methods/shell.js': {
            // openClientPanel('dc'): only ever reached by a signed-in Client clicking
            // a sidebar/rail button, same category as syncAssignedProjectPresence above.
            loadClientDocuments: 'signed-in',
        },
    };

    const eagerFiles = [
        'app.js', 'app/state.js', 'app/views.js',
        ...importsOf('app.js').map(group => `app/methods/${group}.js`),
    ];
    for (const file of eagerFiles) {
        const source = codeOf(file);
        for (const [name, group] of portalOnly) {
            if (!new RegExp(`this\\.${name}\\b`).test(source)) continue;
            assert.ok(ALLOWED[file]?.[name], `${file} calls ${name}() from app/methods/${group}.js, which is not loaded before sign-in`);
        }
    }
});

test('the after-load exceptions really do come after the load', () => {
    const auth = readRoot('app/methods/auth.js');
    const completeLogin = auth.slice(auth.indexOf('async completeLogin('));
    const loadedAt = completeLogin.indexOf('this.ensurePortalViews(role)])');
    assert.ok(loadedAt > -1);
    assert.ok(loadedAt < completeLogin.indexOf('this.resetAllForms()'));
    assert.ok(loadedAt < completeLogin.indexOf('this.initFirebaseRealtime()'));

    const entry = readRoot('app.js');
    const restore = entry.slice(entry.indexOf('onAuthStateChanged(auth'));
    const restoreLoadAt = restore.indexOf('this.ensurePortalViews(role)])');
    assert.ok(restoreLoadAt > -1, 'a restored session must fetch the portal');
    assert.ok(restoreLoadAt < restore.indexOf('this.resetAllForms()'), 'resetAllForms() calls into portal code');
    assert.ok(restoreLoadAt < restore.indexOf('this.initFirebaseRealtime()'));

    // mounted() no longer prepares signed-in forms for every visitor…
    const mounted = entry.slice(entry.indexOf('    mounted() {'), entry.indexOf('onAuthStateChanged(auth'));
    assert.doesNotMatch(mounted, /this\.(autoCalculatePayroll|generateDocNo|installUniversalButtonContextMenu)\(\)/);
    // …startPortal() does, once, after the code arrives.
    const portal = readRoot('app/portal.js');
    assert.match(portal, /export function startPortal\(vm\) \{[\s\S]*vm\.autoCalculatePayroll\(\);[\s\S]*vm\.generateDocNo\(\);[\s\S]*vm\.installUniversalButtonContextMenu\(\);/);
    assert.match(readRoot('app/methods/shell.js'), /this\.portalCodeLoaded = true;\s*\r?\n\s*startPortal\(this\);/);
});

test('what the sign-in page renders never evaluates portal code', () => {
    const portalOnly = portalOnlyMethods();
    const page = readRoot('index.html');
    const signIn = page.slice(0, page.indexOf('SIGNED-IN PORTAL'));

    for (const [name, group] of portalOnly) {
        assert.doesNotMatch(signIn, new RegExp(`\\b${name}\\b`), `the sign-in page calls ${name}() from ${group}`);
    }

    // Computed values are eager, so check the ones the sign-in page and the
    // mount-time watcher actually read — and everything those read in turn.
    const computed = new Map();
    for (const file of fs.readdirSync(path.join(ROOT, 'app/computed'))) {
        const source = readRoot(`app/computed/${file}`);
        const defs = [...source.matchAll(/^ {8}([A-Za-z_$][\w$]*)\s*\(\)\s*\{/gm)];
        defs.forEach((m, i) => computed.set(m[1], source.slice(m.index, defs[i + 1] ? defs[i + 1].index : source.length)));
    }
    const pending = [...computed.keys()].filter(name => new RegExp(`\\b${name}\\b`).test(signIn));
    pending.push('anyOverlayOpen'); // watched in app.js, so evaluated at mount
    const reached = new Set();
    while (pending.length) {
        const name = pending.pop();
        if (reached.has(name) || !computed.has(name)) continue;
        reached.add(name);
        for (const m of computed.get(name).matchAll(/this\.([A-Za-z_$][\w$]*)/g)) {
            assert.ok(!portalOnly.has(m[1]), `${name} is read before sign-in and calls ${m[1]}() from ${portalOnly.get(m[1])}`);
            if (computed.has(m[1])) pending.push(m[1]);
        }
    }
    assert.ok(reached.has('anyOverlayOpen'));
});

test('the sign-in methods the portal code used to own now load up front', () => {
    // Both sign-in paths read the account record and sync its claims before the
    // portal is fetched, so these two moved out of account administration.
    const auth = readRoot('app/methods/auth.js');
    const admin = readRoot('app/methods/admin-users.js');
    for (const name of ['loadOrMigrateUserMetadata', 'syncUserClaims']) {
        assert.match(auth, new RegExp(`^ {8}async ${name}\\(`, 'm'), `${name} must be in auth.js`);
        assert.doesNotMatch(admin, new RegExp(`^ {8}async ${name}\\(`, 'm'), `${name} must not also remain in admin-users.js`);
    }
});
