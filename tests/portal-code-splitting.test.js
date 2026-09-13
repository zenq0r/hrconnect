const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROOT, readSource, constantSource } = require('./helpers/sources');

const indexHtml = () => fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const viewsLoader = () => fs.readFileSync(path.join(ROOT, 'app', 'views.js'), 'utf8');
const viewFiles = () => fs.readdirSync(path.join(ROOT, 'views')).filter(name => name.endsWith('.html'));

// The whole point of the split: what a stranger can read before signing in is
// the sign-in page, not the map of the system.
test('the unauthenticated page carries no part of the signed-in portal', () => {
    const page = indexHtml();

    // No screen. Each one is a v-show/v-if on currentTab, wherever it lives.
    assert.doesNotMatch(page, /currentTab === '/, 'no screen may be inlined in the sign-in page');
    // No navigation, so no list of modules.
    assert.doesNotMatch(page, /zq-sidebar-nav/, 'the module list must not ship before sign-in');
    assert.doesNotMatch(page, /switchTab\(/, 'the routes must not ship before sign-in');
    // No record forms, drawers or print layouts.
    assert.doesNotMatch(page, /print-template-/, 'print layouts must not ship before sign-in');
    assert.doesNotMatch(page, /employeeModal|staffPortalAccount|websiteContentModal/, 'admin overlays must not ship before sign-in');

    // What it does carry is the sign-in screen and the mount points.
    assert.match(page, /id="auth-main"/);
    assert.match(page, /<zq-view name="portal-shell">/);
    assert.match(page, /<zq-view name="shared-modals">/);
    assert.match(page, /<zq-view name="print-templates">/);
});

test('the sign-in page stays small enough to read at a glance', () => {
    const lines = indexHtml().split(/\r?\n/).length;
    // It was 4,536 lines when every screen lived here. This is a guard rail, not
    // a target: if a screen is being added back inline, this notices.
    assert.ok(lines < 800, `index.html is ${lines} lines — a screen has probably been inlined again`);
});

test('every view file is registered, and every registered view exists', () => {
    const loader = viewsLoader();
    const names = loader.slice(loader.indexOf('const VIEW_NAMES'), loader.indexOf(']);', loader.indexOf('const VIEW_NAMES')));
    const registered = [...names.matchAll(/'([a-z-]+)'/g)].map(m => `${m[1]}.html`).sort();
    const onDisk = viewFiles().sort();

    assert.deepEqual(registered, onDisk, 'app/views.js and views/ must name exactly the same files');
    assert.ok(onDisk.length > 10, 'the portal is split per screen, not into two halves');
});

test('every module a role can open resolves to a screen', () => {
    const loader = viewsLoader();
    const tabViews = loader.slice(loader.indexOf('const TAB_VIEWS'), loader.indexOf('export const ALWAYS_LOADED_VIEWS'));
    const routed = new Set([...tabViews.matchAll(/'([a-z-]+)':/g)].map(m => m[1]));

    const modules = new Function(`${constantSource('MODULE_LABELS')} return Object.keys(MODULE_LABELS);`)();
    const legacy = new Function(`${constantSource('CLIENT_LEGACY_TABS')} return Object.keys(CLIENT_LEGACY_TABS);`)();

    for (const moduleName of modules) {
        // A legacy client tab is a panel of the client workspace, not a route.
        if (legacy.includes(moduleName)) continue;
        assert.ok(routed.has(moduleName), `${moduleName} is in the access matrix but has no screen to load`);
    }
});

test('a client session never loads a staff screen', () => {
    const loader = viewsLoader();
    const always = loader.slice(loader.indexOf('export const ALWAYS_LOADED_VIEWS'), loader.indexOf('export function viewForTab'));

    // The shell, the shared overlays and the print layouts are all a session
    // needs before it knows where it is going. Anything else here would be a
    // staff screen downloaded by every client.
    assert.match(always, /\['portal-shell', 'shared-modals', 'print-templates'\]/);
    assert.match(loader, /export function homeTabFor\(role\) \{\s*return role === 'Client' \? 'client-portal' : 'dashboard';/);
});

test('the screens are deployed, and the loader can reach them', () => {
    const ignore = readSource('.vercelignore');
    assert.doesNotMatch(ignore, /^views\/?$/m, 'the screens must ship with the deployment');
    assert.doesNotMatch(ignore, /^app\/?$/m, 'the application modules must ship with the deployment');

    // The portal also answers on /auth/action, where a relative path would
    // resolve against /auth/ and miss every view.
    const loader = viewsLoader();
    assert.match(loader, /return `\/views\/\$\{name\}`;/);

    // Extensionless, because Vercel's cleanUrls answers the .html spelling with
    // a 308 — an extra round trip per screen, measured on production. That
    // depends on cleanUrls staying on. views/ is kept out of the sign-in page
    // fallback, so without it the extensionless request is a 404 — never the
    // sign-in page compiled into a screen — and the loader asks for the file.
    const vercel = JSON.parse(readSource('vercel.json'));
    assert.equal(vercel.cleanUrls, true);
    const fallbackRule = vercel.rewrites.find(rule => rule.source.includes('(?!'));
    const fallback = new RegExp(`^${fallbackRule.source}$`);
    assert.equal(fallback.test('/dashboard'), true, 'a portal route still opens the portal');
    assert.equal(fallback.test('/views/portal-shell'), false, 'a missing view must not be answered with the sign-in page');
    // With cleanUrls on, Vercel files index.html under /index, so a rewrite to
    // /index.html finds no file and answers 404 — which is what every deep link
    // got until this was measured on a deployment. "/" is the page itself.
    for (const rule of vercel.rewrites.filter(r => r.source !== '/favicon.ico')) {
        assert.equal(rule.destination, '/', `${rule.source} must rewrite to "/", not to a file cleanUrls has renamed`);
    }
    assert.match(loader, /if \(!response\.ok\) response = await fetch\(`\$\{viewUrl\(name\)\}\.html`, options\);/);

    // The update check asks for the same spelling, or every check is a redirect.
    assert.match(readSource('app/methods/shell.js'), /`\$\{viewUrl\('portal-shell'\)\}\?_v=\$\{Date\.now\(\)\}`/);

    // And the deployment must not let them go stale behind a cache.
    for (const prefix of ['/app/(.*)', '/views/(.*)']) {
        const rule = vercel.headers.find(entry => entry.source === prefix);
        assert.ok(rule, `${prefix} needs a cache rule`);
        assert.match(rule.headers.find(h => h.key === 'Cache-Control').value, /no-cache/);
    }
    // Nor behind the service worker: only a good response becomes the offline copy.
    assert.match(readSource('sw.js'), /if \(response\.ok\) \{\s*const clone = response\.clone\(\);/);
});

test('a screen is mounted once and then kept', () => {
    const shell = readSource('app/methods/shell.js');
    // Re-mounting on every visit would throw away a half-filled form, which is
    // what v-show gave the screens when they all lived in one file.
    assert.match(shell, /if \(!this\.isLoggedIn \|\| !view \|\| this\.mountedViews\.includes\(view\)\) return;/);
    // And the portal is never shown before its own shell has arrived.
    assert.match(readSource('app/methods/auth.js'), /await Promise\.all\(\[this\.syncUserClaims\(\), this\.ensurePortalViews\(role\)\]\);\s*\r?\n\s*this\.resetAllForms\(\); this\.isLoggedIn = true;/);
});

// The fallback serves the page on any path, /client-portal/documents included.
// A page-relative "./app.js" there asks for /client-portal/app.js, which does
// not exist, and the portal never starts.
test('the page finds its own files from any path it is served on', () => {
    const markup = readSource('index.html');
    const relative = markup.match(/\s(?:src|href)="\.\/[^"]+"/g) || [];
    assert.deepEqual(relative, [], 'asset references must be root-absolute');
    assert.match(markup, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
    assert.match(markup, /<script type="module" src="\/app\.js"><\/script>/);
});

// The stylesheet is built from the files Tailwind is told to read. A screen
// that moved out of index.html keeps its classes only if its new home is read.
test('the stylesheet build reads every file the markup and classes moved to', () => {
    const { content } = require(path.join(ROOT, 'tailwind.config.js'));
    for (const glob of ['./index.html', './app.js', './app/**/*.js', './views/**/*.html']) {
        assert.ok(content.includes(glob), `tailwind.config.js content must include ${glob}`);
    }
});
