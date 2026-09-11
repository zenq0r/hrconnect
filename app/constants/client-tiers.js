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
    { key: 'full-timeline', minTier: 1, label: 'Full activity timeline', detail: 'Every recorded step on a project, not just its stage.' },
    { key: 'client-reply', minTier: 1, label: 'Reply to your officer', detail: 'Two-way conversation on each project update.' },
    { key: 'account-statement', minTier: 1, label: 'Download account statement', detail: 'A CSV statement of every transaction on record.' },
    { key: 'officer-presence', minTier: 2, label: 'Live officer availability', detail: 'See when the officer handling your account is online.' },
    { key: 'expiry-alerts', minTier: 2, label: 'Early expiry warnings', detail: 'Advance notice before a document or licence lapses.' }
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