// What counts as an acceptable password for a portal that holds salaries, IC
// numbers and bank accounts.
//
// The same rule is written a second time in api/_security.js, because the
// browser cannot be trusted to apply it and the server cannot import an ES
// module from here. tests/password-policy.test.js runs both copies over the
// same passwords and fails if they ever disagree.
export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_POLICY_TEXT =
    `At least ${PASSWORD_MIN_LENGTH} characters, including an uppercase letter, a lowercase letter, a number and a symbol.`;

// Returns the reason this password is refused, or '' when it is accepted.
export function passwordPolicyError(password) {
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
