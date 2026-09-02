const crypto = require('crypto');
const APPROVED_STAFF_DOMAINS = new Set(['zenq0r.com', 'zenqor.com.my']);

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

module.exports = { generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, isApprovedStaffEmail };
