const crypto = require('crypto');

const RBAC_OTP_ROLES = Object.freeze(['Superadmin', 'Director', 'HR', 'Account', 'IT', 'Staff', 'Client']);

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

function requiresOtpRole(role) {
    return RBAC_OTP_ROLES.includes(role);
}

module.exports = { RBAC_OTP_ROLES, generateOtp, hashOtp, hashResetToken, isAllowedPortalUrl, normalizeEmail, requiresOtpRole };
