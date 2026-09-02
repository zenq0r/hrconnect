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

function isSeedAdminEmail(value) {
    return SEED_ADMIN_EMAILS.has(String(value || '').trim().toLowerCase());
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

module.exports = { generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, isApprovedStaffEmail, isSeedAdminEmail, SEED_ADMIN_PRIMARY };
