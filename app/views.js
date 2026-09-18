// On-demand screen loading.
//
// The portal's markup used to sit in index.html in full, which meant anyone who
// opened the site — signed in or not — downloaded the whole admin application:
// every module name, every role, every workflow. Only the sign-in screen ships
// in index.html now. Everything behind it lives in views/ and is fetched the
// first time it is genuinely needed.
//
// A view is compiled into a render function and then rendered with the ROOT
// component's context, not its own. That is what makes this a pure split: the
// markup inside a view still reads `currentTab`, `docForm`, `saveProject(...)`
// exactly as it did when it was one file, with no props to thread through and
// no state to lift. Nothing about how a screen is written changes — only when
// its bytes arrive.

// Every screen in views/, named as its file is without the .html.
const VIEW_NAMES = new Set([
    'portal-shell',
    'shared-modals',
    'print-templates',
    'tab-dashboard',
    'tab-announcements',
    'tab-client-task',
    'tab-projects',
    'tab-documents',
    'tab-payslip',
    'tab-claims',
    'tab-client-directory',
    'tab-hr-employees',
    'tab-attendance',
    'tab-duty-roster',
    'tab-leave',
    'tab-reports',
    'tab-client-portal',
    'tab-website-content',
    'tab-audit-logs',
    'tab-settings',
    'tab-doc-generator',
]);

// currentTab -> the file that draws it. Settings and Profile are two tabs on
// one screen, which is why they share an entry.
const TAB_VIEWS = {
    'dashboard': 'tab-dashboard',
    'announcements': 'tab-announcements',
    'client-task': 'tab-client-task',
    'project-activities': 'tab-projects',
    'document-quotations': 'tab-documents',
    'payslip-generator': 'tab-payslip',
    'claims': 'tab-claims',
    'client-directory': 'tab-client-directory',
    'hr-employees': 'tab-hr-employees',
    'attendance': 'tab-attendance',
    'duty-roster': 'tab-duty-roster',
    'leave': 'tab-leave',
    'reports': 'tab-reports',
    'client-portal': 'tab-client-portal',
    'website-content': 'tab-website-content',
    'audit-logs': 'tab-audit-logs',
    'settings': 'tab-settings',
    'profile': 'tab-settings',
    'doc-generator': 'tab-doc-generator',
};

// Loaded as soon as a session is confirmed, whatever the role: the shell draws
// the portal, the shared overlays are raised from several screens, and a print
// is triggered synchronously so its template cannot be fetched at the moment
// the print starts.
export const ALWAYS_LOADED_VIEWS = ['portal-shell', 'shared-modals', 'print-templates'];

export function viewForTab(tab) {
    return TAB_VIEWS[tab] || '';
}

export function homeTabFor(role) {
    return role === 'Client' ? 'client-portal' : 'dashboard';
}

const compiled = new Map();
const inFlight = new Map();

export function compiledView(name) {
    return compiled.get(name) || null;
}

// Where a view is fetched from, without the extension. Vercel serves this site
// with cleanUrls on, which answers `/views/x.html` with a 308 to `/views/x` — a
// whole extra round trip for every screen, four of them at every sign-in. The
// extensionless path is served directly.
export function viewUrl(name) {
    return `/views/${name}`;
}

async function fetchViewMarkup(name) {
    // Root-absolute: the portal also answers on /auth/action, where a relative
    // path would resolve against /auth/ and miss. `no-cache` keeps a revalidation
    // round-trip rather than a stale screen after a deploy.
    const options = { cache: 'no-cache', credentials: 'same-origin' };
    // The extensionless path is a file only while cleanUrls is on. vercel.json
    // keeps views/ out of the sign-in page fallback, so without cleanUrls — or
    // on a plain static server — it is a 404, and the literal file is asked for.
    let response = await fetch(viewUrl(name), options);
    if (!response.ok) response = await fetch(`${viewUrl(name)}.html`, options);
    if (!response.ok) throw new Error(`${response.status} while loading ${viewUrl(name)}`);
    return response.text();
}

export function loadView(name) {
    if (compiled.has(name)) return Promise.resolve(compiled.get(name));
    if (inFlight.has(name)) return inFlight.get(name);

    if (!VIEW_NAMES.has(name)) return Promise.reject(new Error(`Unknown portal view: ${name}`));
    if (typeof Vue?.compile !== 'function') return Promise.reject(new Error('This build of Vue cannot compile a view at runtime.'));

    const task = fetchViewMarkup(name)
        .then(html => {
            const render = Vue.compile(html);
            compiled.set(name, render);
            inFlight.delete(name);
            return render;
        })
        .catch(error => {
            inFlight.delete(name);
            throw error;
        });

    inFlight.set(name, task);
    return task;
}

// Renders one view inside the root component's scope.
//
// `Vue.compile` returns `render(_ctx, _cache)`, and the runtime compiler wraps
// the body in `with (_ctx)`, so handing it the root instance is what lets the
// view read and write root state directly. `_cache` is per-instance, which is
// what the compiler assumes for its cached event handlers.
export const ZqView = {
    name: 'ZqView',
    props: { name: { type: String, required: true } },
    setup(props) {
        const host = Vue.inject('zqPortalHost', null);
        const render = Vue.shallowRef(compiledView(props.name));
        const cache = [];

        const ensure = (name) => {
            const ready = compiledView(name);
            if (ready) { render.value = ready; return; }
            render.value = null;
            loadView(name)
                .then(fn => { if (props.name === name) render.value = fn; })
                .catch(error => console.error(`Portal view "${name}" failed to load:`, error));
        };

        if (!render.value) ensure(props.name);
        Vue.watch(() => props.name, ensure);

        return () => {
            const fn = render.value;
            return fn && host ? fn(host, cache) : null;
        };
    },
};
