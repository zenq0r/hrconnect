const crypto = require('crypto');
const APPROVED_STAFF_DOMAINS = new Set(['zenq0r.com', 'zenqor.com.my']);

// The protected seed administrator — the account that cannot be deleted, can
// restore its own profile, and is trusted as Superadmin even before its
// Firestore record exists. It is the last line of defence against a total
// lockout, so BOTH addresses count while it moves to zenqor.com.my: the new one
// so it holds those powers the moment it is created, the old one so the account
// signed in today does not lose them mid-move. Drop the legacy entry once it is
// retired. This was copied by hand into five files before; keep it here only.
const SEED_ADMIN_EMAILS = new Set(['info@zenqor.com.my', 'admin@zenq0r.com']);
const SEED_ADMIN_PRIMARY = 'info@zenqor.com.my';

// Every outbound Resend email sends from this address. It was written by hand
// into three API files as support@zenqor.com.my, which is no longer a mailbox
// the company reads — keep it here only, so the next move is one edit.
const MAIL_FROM = 'ZENQOR Technologies <info@zenqor.com.my>';

function isSeedAdminEmail(value) {
    return SEED_ADMIN_EMAILS.has(String(value || '').trim().toLowerCase());
}

// Deliberately a second copy of app/constants/password-policy.js. A rule the
// browser applies is a hint; this is where it is decided. Any password the
// portal sets or resets passes through here, and the two copies are held
// together by tests/password-policy.test.js.
const PASSWORD_MIN_LENGTH = 12;

function passwordPolicyError(password) {
    const value = String(password || '');
    if (value.length < PASSWORD_MIN_LENGTH) {
        return `Your new password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
    }
    const missing = [];
    if (!/[a-z]/.test(value)) missing.push('a lowercase letter');
    if (!/[A-Z]/.test(value)) missing.push('an uppercase letter');
    if (!/[0-9]/.test(value)) missing.push('a number');
    if (!/[^A-Za-z0-9]/.test(value)) missing.push('a symbol');
    if (missing.length) return `Your new password still needs ${missing.join(', ')}.`;
    return '';
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(code) {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Hostnames a password-reset / notification link may point at. An exact-match set,
// never a suffix test: 'evilwww.hrct.zenq0r.com' and 'www.hrct.zenq0r.com.evil.test'
// both have to fail, and endsWith() would let one of them through.
//
// Both the old and the new portal hostname are listed while the move off
// zenqor.com.my is in progress, so a link already sitting in someone's inbox keeps
// working. Drop the zenqor.com.my entry once that domain is gone for good.
// Where new links point. The set below still accepts the retired hosts so a
// link already sitting in an inbox keeps working, but nothing new may be built
// with them — that split is why the reset email went on pointing at a dead
// address long after the portal had moved.
const PORTAL_URL = 'https://www.hrconnect.zenqor.com.my/';

const APPROVED_PORTAL_HOSTS = new Set([
    'www.hrconnect.zenqor.com.my',
    // Hosts the portal answered on earlier today and before. Kept only so a
    // reset link already sitting in someone's inbox still validates; both are
    // dead addresses now, so prune them once outstanding links have expired.
    'www.hrct.zenq0r.com',
    'www.hrct.portal.zenqor.com.my'
]);

function isAllowedPortalUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && APPROVED_PORTAL_HOSTS.has(url.hostname);
    } catch (_) {
        return false;
    }
}

function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isApprovedStaffEmail(value) {
    const email = normalizeEmail(value);
    if (!email) return false;
    const parts = email.split('@');
    return parts.length === 2 && APPROVED_STAFF_DOMAINS.has(parts[1]);
}

module.exports = { generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, isApprovedStaffEmail, isSeedAdminEmail, passwordPolicyError, PASSWORD_MIN_LENGTH, SEED_ADMIN_PRIMARY, MAIL_FROM, PORTAL_URL };
