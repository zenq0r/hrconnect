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

const VIEW_FILES = {
    'portal-shell': 'portal-shell.html',
    'shared-modals': 'shared-modals.html',
    'print-templates': 'print-templates.html',
    'tab-dashboard': 'tab-dashboard.html',
    'tab-client-task': 'tab-client-task.html',
    'tab-projects': 'tab-projects.html',
    'tab-documents': 'tab-documents.html',
    'tab-payslip': 'tab-payslip.html',
    'tab-claims': 'tab-claims.html',
    'tab-client-directory': 'tab-client-directory.html',
    'tab-hr-employees': 'tab-hr-employees.html',
    'tab-reports': 'tab-reports.html',
    'tab-client-portal': 'tab-client-portal.html',
    'tab-website-content': 'tab-website-content.html',
    'tab-audit-logs': 'tab-audit-logs.html',
    'tab-settings': 'tab-settings.html',
    'tab-doc-generator': 'tab-doc-generator.html',
};

// currentTab -> the file that draws it. Settings and Profile are two tabs on
// one screen, which is why they share an entry.
const TAB_VIEWS = {
    'dashboard': 'tab-dashboard',
    'client-task': 'tab-client-task',
    'project-activities': 'tab-projects',
    'document-quotations': 'tab-documents',
    'payslip-generator': 'tab-payslip',
    'claims': 'tab-claims',
    'client-directory': 'tab-client-directory',
    'hr-employees': 'tab-hr-employees',
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

export function loadView(name) {
    if (compiled.has(name)) return Promise.resolve(compiled.get(name));
    if (inFlight.has(name)) return inFlight.get(name);

    const file = VIEW_FILES[name];
    if (!file) return Promise.reject(new Error(`Unknown portal view: ${name}`));
    if (typeof Vue?.compile !== 'function') return Promise.reject(new Error('This build of Vue cannot compile a view at runtime.'));

    // Root-absolute: the portal also answers on /auth/action, where a relative
    // path would resolve against /auth/ and miss. `no-cache` keeps a revalidation
    // round-trip rather than a stale screen after a deploy.
    const task = fetch(`/views/${file}`, { cache: 'no-cache', credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) throw new Error(`${response.status} while loading ${file}`);
            return response.text();
        })
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
