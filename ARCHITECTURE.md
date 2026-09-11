# How this portal is put together

No build step, no bundler. The browser loads native ES modules and Vue's
runtime compiler, so what is in the repository is what ships.

```
index.html            the sign-in page, and nothing else
app.js                entry point: builds the Vue app out of app/
app/
  config.js           portal URL, seed administrators, changelog, greeting timing
  constants/
    rbac.js           which role opens which module; Staff Portal action lists
    client-tiers.js   Standard / Premium / Priority, and what each one opens
    statutory.js      EPF, SOCSO, EIS, PCB rates; the postcode table
    site-text.js      every translatable key on the public zenqor.com.my site
  directives/
    longpress.js      long-press as the touch equivalent of a right-click
  state.js            every reactive field a session starts with
  computed/           derived values, by area (access, reports, billing, …)
  methods/            behaviour, by area (auth, claims, projects, hr, …)
  views.js            fetches, compiles and mounts the screens in views/
views/
  portal-shell.html   sidebar and top bar
  tab-*.html          one file per screen
  shared-modals.html  overlays more than one screen raises
  print-templates.html quotation, invoice, payslip, approved claim
api/                  Vercel serverless functions (OTP, e-mail, audit, claims)
functions/            Firebase Functions (account lifecycle)
firestore.rules       the access rules that actually enforce all of the above
```

## Nothing of the portal loads before sign-in

`index.html` used to hold the whole application — every module, every role
name, every workflow — so anyone who opened the site could read the entire
system out of the page source without an account. It now holds the sign-in
screen and three mount points.

Everything behind sign-in is fetched when it is needed:

| when | what arrives |
| --- | --- |
| a session is confirmed | `portal-shell`, `shared-modals`, `print-templates`, and the home screen for that role |
| a screen is opened for the first time | that screen's `tab-*.html` |
| afterwards | nothing — a screen stays mounted once loaded |

A client account therefore downloads four files and never sees the staff
modules at all; a staff account downloads the screens that person actually
opens.

**This is exposure reduction, not access control.** The files under `views/`
are static and anyone who knows a URL can still fetch one. What it removes is
the free map: no unauthenticated visitor is handed the module list, the role
names and the workflows simply for loading the page. Real data is protected by
`firestore.rules` and by the checks in `api/_security.js`, and always was.

### What is still loaded up front

The markup is split; the JavaScript is not. Every module under `app/` is a
static import of `app.js`, so the logic still arrives in full on first load —
around 650 KB of it, cached and revalidated, against 36 KB of `index.html`
where the page used to be 529 KB. Reading it tells you the Firestore collection
names and the shape of the workflows, though not the module list a person can
actually open, and none of the portal's text.

Making that lazy too is a separate change with a specific shape: `computed`
values must stay eager (Vue resolves them when the component is created),
`mounted()` calls a handful of methods at boot, and the rest of the method
groups could be dynamically imported alongside the views and merged onto the
instance. It is worth doing deliberately, not as a side effect of moving files.

## How a screen can live in its own file without being rewritten

`app/views.js` fetches a view, compiles it with `Vue.compile()`, and renders it
with the **root component's** context rather than its own. The markup inside a
view keeps reading `currentTab`, `docForm` and `saveProject(...)` exactly the
way it did when it all lived in one file — no props threaded through, no state
lifted, no component boundary to cross.

The consequence worth knowing: a view is not an isolated component. It can read
and write any root state, same as before. Splitting a screen out is a move, not
a refactor.

Screens are mounted through one `<zq-view v-for="view in mountedViews">` inside
`<main>` in `views/portal-shell.html`, and `mountedViews` only ever grows during
a session. That is deliberate: a screen keeps its DOM after you leave it, so a
half-filled form survives a trip to another tab, which is what `v-show` gave the
screens when they were all in one file.

Adding a screen means three things: the file in `views/`, an entry in
`VIEW_FILES`, and an entry in `TAB_VIEWS` mapping the `currentTab` value to it.
`tests/portal-code-splitting.test.js` fails if any of the three is missing.

## app.js is an entry point

Method bodies moved verbatim into `app/methods/*.js` and are spread back into
one `methods:` object, so `this.<method>()` resolves exactly as it always did
and no call site changed. The same applies to `computed/`. Imports in those
files are a deliberate superset — an unused import is inert, a missing one
would be a `ReferenceError` on some screen nobody opens often.

## Tests read source, not a browser

`tests/helpers/sources.js` serves `app.js` plus every `app/` module as one blob,
and `index.html` plus every `views/` fragment as another, so a test finds a
method or a template block wherever it now lives. Tests that lift real code out
to evaluate it use `methodSource()` / `constantSource()` rather than slicing
between two markers — a slice between two names that now sit in different
modules would swallow the module boundary and fail as a syntax error.

```bash
npm run check   # node --check on every .js, plus tag nesting on every template
npm test        # the suite
```
