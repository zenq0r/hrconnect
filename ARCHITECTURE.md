# How this portal is put together

No build step, no bundler. The browser loads native ES modules and Vue's
runtime compiler, so what is in the repository is what ships.

```
index.html            the sign-in page, and nothing else
app.js                entry point: the sign-in page's code, and the Vue app itself
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
  portal.js           the method groups fetched only after sign-in
  views.js            fetches, compiles and mounts the screens in views/
views/
  portal-shell.html   sidebar and top bar
  tab-*.html          one file per screen
  shared-modals.html  overlays more than one screen raises
  print-templates.html quotation, invoice, payslip, approved claim
api/                  Vercel serverless functions (OTP, e-mail, audit, claims)
functions/            Firebase Functions (account lifecycle, billing totals check)
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

### The code is split the same way

| before sign-in | after sign-in |
| --- | --- |
| `app.js` and what it imports — about 237 KB: state, computed values, and the method groups a sign-in needs (`auth`, `shell`, `forms`, `display`, `presence`, `dashboard`, `audit`, `notifications`, `access`) | `app/portal.js`, fetched with `import()` inside `ensurePortalCode()`: projects, clients, claims, billing, payroll, uploads, reports, HR, account administration, the CMS, and every Firestore subscription |

Where the whole portal used to be ~650 KB of JavaScript on first load, a
visitor now receives about a third of it — and none of the parts that name the
collections or walk through a workflow.

Three things about the split are worth knowing before changing it:

- **Computed values stay eager.** Vue resolves `computed` when the component is
  created, so they cannot be attached later. That is safe only because nothing
  the sign-in page reads calls into portal code — and a test checks exactly that.
- **Portal methods are bound on arrival**, the way Vue binds `methods:`, so
  `this.saveProject()`, `@click="saveProject"` and a method passed along as a
  callback all behave as though it had been there from the start.
- **A new call from sign-in code into a portal method fails the build.**
  `tests/portal-code-loading.test.js` knows every path that runs before the code
  arrives, and lists each existing reference with its reason — guarded by a
  modal that cannot be open yet, or only reached after `ensurePortalViews()`. A
  reference that is not on that list has to be decided, not discovered in
  production.

If a method moves into sign-in (as `loadOrMigrateUserMetadata` and
`syncUserClaims` did, because both sign-in paths call them before the portal is
fetched), it moves to one of the eager modules — not just into the list.

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
`VIEW_NAMES`, and an entry in `TAB_VIEWS` mapping the `currentTab` value to it.
`tests/portal-code-splitting.test.js` fails if any of the three is missing.

## app.js is an entry point

Method bodies moved verbatim into `app/methods/*.js`. The groups a sign-in
needs are spread into `methods:` in `app.js`; the rest are spread into
`portalMethods` in `app/portal.js` and bound onto the same component when it
arrives. Either way `this.<method>()` resolves exactly as it always did, and no
call site changed. The same applies to `computed/`. Imports in those
files are a deliberate superset — an unused import is inert, a missing one
would be a `ReferenceError` on some screen nobody opens often.

## Where each rule is actually enforced

The browser is where things are *shown*, never where they are decided. Each
kind of rule, and the place it holds:

| rule | enforced in | notes |
| --- | --- | --- |
| who may read or write a record | `firestore.rules` | roles come from `users/{uid}`, and a locked account holds no role |
| derived money figures | `firestore.rules` | SST, EPF, SOCSO, EIS and totals are recomputed against their own inputs |
| a document's line items add up | `functions/` `verifyBillingDocumentTotals` | rules cannot iterate a list; the trigger corrects and audits instead |
| password policy | `api/_security.js` | the copy in `app/constants/password-policy.js` is the hint shown while typing |
| attachment access | `storage.rules` | the uploader and the staff who approve, capped at one type and size |

Two things are deliberately **not** enforced server-side, and should be read as
known gaps rather than oversights:

- **The second factor** (`SECOND_FACTOR_ROLES`) decides whether the portal
  opens, not whether the session exists — the password has already been
  accepted by Firebase when the code is asked for. Someone driving the Firebase
  SDK by hand is not stopped by it. Closing that means having
  `api/verify-login-otp.js` set a custom claim that `firestore.rules` then
  requires, which signs out every open session the day it ships. That is an
  operational decision.
- **A commercial figure** — a price, a salary, a claim amount — is whatever the
  authorised role says it is. The rules only hold the *derived* figures to the
  inputs they claim to come from.

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

## Deploying a change

The portal itself is static and ships with the Vercel deployment, `/api`
included. Three things do not, and are deployed separately with the Firebase
CLI — a change to any of them has no effect until it is:

```bash
firebase deploy --only firestore:rules,storage:rules,functions
```

`firestore.rules` and `storage.rules` are the enforcement above; `functions/`
holds the auth-lifecycle cleanup and the billing totals check.

**Order matters, and it is portal first, rules second.** The money rules check
figures the portal only started filing recently — a quotation's `subtotal` and
`sst`, and a receipt's Storage path. Deploying the rules while the previous
portal is still live would refuse every new invoice and every attachment,
because the old code does not send what the new rule asks for. The reverse gap
is harmless: for the few minutes between the two, a consistent set of figures is
written and simply not yet re-checked.

A browser tab left open on the old code across the rules deploy will be refused
until it is reloaded. The portal's update banner is what tells that tab to.
