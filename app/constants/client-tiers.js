// ---- Client tier model ----------------------------------------------------
// Until now clientTier was a badge and nothing else. These constants are the
// single source of truth for what a tier actually opens, and every gate -- UI,
// method guard and firestore.rules -- is derived from them rather than
// re-listing tiers by hand. Order matters: the index IS the rank.
export const CLIENT_TIER_ORDER = ['Standard', 'Premium', 'Priority'];

// clientTier is NOT in normalizeOfficialRecord's protected-key list, so every
// client record on file stores it uppercased ('PRIORITY', not 'Priority').
// Comparing exact case therefore matched nothing: every client read back as
// Standard, the staff Priority Clients panel was permanently empty, and the
// tier badge always printed Standard. Every read of a stored tier goes
// through here; an unknown value falls back to the lowest tier, never the
// highest.
export function canonicalClientTier(value) {
    const wanted = String(value || '').trim().toUpperCase();
    return CLIENT_TIER_ORDER.find(tier => tier.toUpperCase() === wanted) || CLIENT_TIER_ORDER[0];
}

// minTier is an index into CLIENT_TIER_ORDER. `key` is the gate name passed to
// clientTierAllows(); anything not listed here is ungated.
export const CLIENT_TIER_FEATURES = [
    { key: 'project-tracking', minTier: 0, label: 'Project and stage tracking', detail: 'See every project and the stage it currently sits at.' },
    { key: 'billing-decisions', minTier: 0, label: 'Quotations and invoices', detail: 'Accept or decline a quotation and download any invoice.' },
    { key: 'payment-proof', minTier: 0, label: 'Submit payment proof', detail: 'Upload a receipt straight onto the invoice it settles.' },
    { key: 'document-access', minTier: 0, label: 'Client document access', detail: 'View every document our team has filed for your account.' },
    { key: 'billing-history', minTier: 0, label: 'Full payment and invoice history', detail: 'Every quotation and invoice on record, with no retention window.' },
    { key: 'basic-notifications', minTier: 0, label: 'Milestone notifications', detail: "Notified when a quotation, invoice or payment reaches a new status." },
    { key: 'full-timeline', minTier: 1, label: 'Full activity timeline', detail: 'Every recorded step on a project, not just its stage.' },
    { key: 'client-reply', minTier: 1, label: 'Reply to your officer', detail: 'Two-way conversation on each project update.' },
    { key: 'account-statement', minTier: 1, label: 'Download account statement', detail: 'A CSV statement of every transaction on record.' },
    { key: 'project-progress-summary', minTier: 1, label: 'Project progress summary', detail: 'A stage-by-stage completion view for every active project.' },
    { key: 'advanced-notifications', minTier: 1, label: 'Proactive status notifications', detail: 'A confirmation is pushed to you the moment we receive your payment proof — not only when Finance verifies it.' },
    { key: 'priority-queue', minTier: 1, label: 'Priority document review', detail: "Your quotations and payment proofs are queued ahead of Standard in Finance's review list." },
    { key: 'transaction-export', minTier: 1, label: 'Export project records', detail: 'Download a CSV of every project linked to your account.' },
    { key: 'officer-presence', minTier: 2, label: 'Dedicated officer, live availability', detail: 'See your dedicated account officer and whether they are online right now.' },
    { key: 'expiry-alerts', minTier: 2, label: 'Early expiry warnings', detail: 'Advance notice before a document or licence on file lapses.' },
    { key: 'deadline-reminders', minTier: 2, label: 'Upcoming deadline visibility', detail: 'A dedicated view of any project activity on your account due within 3 days.' },
    { key: 'issue-escalation', minTier: 2, label: 'Escalate directly to a Director', detail: 'Raise an issue straight to Director/Superadmin, bypassing the normal queue.' }
];

// Support response commitment per tier, indexed the same way.
export const CLIENT_SUPPORT_CHANNELS = [
    { name: 'Email Support', promise: 'Reply within 3 working days' },
    { name: 'Priority Support', promise: 'Reply within 1 working day' },
    { name: 'Direct Channel', promise: 'Same-day reply, direct line to your officer' }
];

// How much of the conversation a client sees without the full-timeline feature.
export const CLIENT_TIMELINE_PREVIEW_COUNT = 5;

// The Client Portal is one route with several panels rather than several
// routes. CLIENT_LEGACY_TABS maps the tabs it replaced onto their panel, so
// an older switchTab() call anywhere still lands somewhere real.
export const CLIENT_PANELS = [
    { key: 'ov', label: 'Overview', icon: 'fa-gauge-high' },
    { key: 'dc', label: 'Documents & Billing', icon: 'fa-folder-open' },
    { key: 'up', label: 'Project Updates', icon: 'fa-bell' },
    { key: 'tb', label: 'Tier Benefits', icon: 'fa-layer-group' },
    { key: 'sp', label: 'Help & Support', icon: 'fa-headset' },
    { key: 'ac', label: 'Account', icon: 'fa-user-shield' }
];
export const CLIENT_LEGACY_TABS = {
    'client-documents': 'dc',
    'client-updates': 'up',
    'client-support': 'sp'
};