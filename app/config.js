// Portal-wide constants: where this deployment lives, who counts as a seed
// administrator, the sign-in greeting timings, and the release changelog.

// Where this portal lives. Written once so a domain move is one edit, not a hunt
// through email bodies — it was hardcoded in two separate places before, and the
// server-side allowlist in api/_security.js is a third that has to agree with it.
export const PORTAL_URL = 'https://www.hrconnect.zenqor.com.my/';

// Mirrors SEED_ADMIN_EMAILS in api/_security.js — see the note there. Both
// addresses count while the seed administrator moves to zenqor.com.my.
export const SEED_ADMIN_EMAILS = new Set(['info@zenqor.com.my', 'admin@zenq0r.com']);
// Where account and support correspondence comes from, and the fallback shown
// when no company email is configured.
export const SUPPORT_EMAIL = 'info@zenqor.com.my';

// A fresh state object is required whenever a Firebase (or legacy) action link
// is opened so no password, code, or success state leaks between attempts.
export const createEmailActionFlow = (overrides = {}) => ({
    active: false,
    source: '',
    mode: '',
    oobCode: '',
    email: '',
    displayName: '',
    companyName: '',
    previousEmail: '',
    temporaryPassword: '',
    verifying: true,
    valid: false,
    otpVerified: false,
    error: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    success: false,
    successTitle: '',
    successDescription: '',
    ...overrides
});

// The verification-code dialog, shared by a password reset and by the sign-in
// second factor. `purpose` says which of the two it is answering.
export const createLoginOtpState = (overrides = {}) => ({
    show: false,
    code: '',
    error: '',
    sending: false,
    verifying: false,
    email: '',
    purpose: '',
    cooldownSeconds: 0,
    ...overrides
});

// Sign-in greeting timing. HOLD covers the fade in plus the pause that follows;
// FADE must stay >= the CSS transition on .zq-welcome-greeting or the overlay
// would unmount mid-fade and vanish instead of easing away.
export const WELCOME_GREETING_HOLD_MS = 2200;
export const WELCOME_GREETING_FADE_MS = 800;

// localStorage key for which sidebar nav groups a user has collapsed —
// a per-browser display preference, never written to Firestore.
export const SIDEBAR_GROUPS_STORAGE_KEY = 'zq_sidebar_groups_collapsed';

// Bump the top entry's `version` (and add a new entry above it) whenever a meaningful feature ships.
// The list is the release history shown under Settings; nothing here interrupts a sign-in.
export const APP_CHANGELOG = [
    {
        version: '2026.09.04-presence-and-approvals',
        title: 'An Online Light You Can Trust',
        notes: [
            'The Directory now shows an account as online only when the email it signs in with is stored on a Staff ID or a Client ID. Super Admin is the one exception, since it is not tied to either.',
            'An account that appears in neither directory now reads Offline rather than Online — add its employee or client record to bring the indicator back.',
            'Super Admin can now Approve and Reject a claim or payment voucher from the record preview. The permission was always there; the buttons were not.',
            'The approve button is now labelled by the stage of the record rather than by who is reading it, so a final approval never reads as "Approve & Forward".'
        ]
    },
    {
        version: '2026.09.04-staff-portal',
        title: 'The Staff Portal Gets Its Buttons',
        notes: [
            'Portal Access Management is now the Staff Portal, with View, Read, Access, Edit, Lock, Reset and Delete on every account.',
            'Locking an account keeps its record and role but refuses the sign-in, ends the open session, and is recorded in the audit log.',
            'Staff can request a role change from their own Profile page; Super Admin and Director accept or reject it in the Staff Portal.',
            'Full access stays with Super Admin and Director. IT observes the Staff Portal read-only for support work.'
        ]
    },
    {
        version: '2026.08.18-client-pages',
        title: 'A Better Client Workspace',
        notes: [
            'The redesigned Client Portal is now the main Dashboard for every Client account.',
            'The old Client dashboard has been retired to remove duplicate information.',
            'Documents, updates, account security and support now open as independent pages with browser Back support.'
        ]
    },
    {
        version: '2026.08.14',
        title: "What's New in ZENQOR Portal",
        notes: [
            'Client Portal now has its own distinct look, separate from the internal staff system.',
            'Clients can reply directly to project updates — Client Activity History is now a two-way conversation.',
            'New "My Projects" quick filter for staff, and document filters for clients.',
            'Dark mode, a notification center, and project client tagging (Standard/Premium/Priority) added.'
        ]
    }
];