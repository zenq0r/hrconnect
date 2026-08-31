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

function isAllowedPortalUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === 'www.hrct.portal.zenqor.com.my';
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
