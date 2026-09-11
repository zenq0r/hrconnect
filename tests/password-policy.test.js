const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource, constantSource } = require('./helpers/sources');
const { passwordPolicyError: serverPolicy, PASSWORD_MIN_LENGTH } = require('../api/_security');

// The policy is written twice on purpose: once for the browser, so somebody
// learns the rule while typing, and once on the server, where it is actually
// decided. Two copies drift. These tests are what stop them.

const browserPolicy = new Function(`
    ${constantSource('PASSWORD_MIN_LENGTH')}
    ${constantSource('passwordPolicyError')}
    return passwordPolicyError;
`)();

const CASES = [
    '',
    'short',
    'password',
    'Password1',           // 9 chars — was acceptable under the old 8-character rule
    'Password1234',        // long enough, no symbol
    'password1234!',       // no uppercase
    'PASSWORD1234!',       // no lowercase
    'Password!!!!!',       // no digit
    'Passw0rd!2026',       // accepted
    'a'.repeat(40),
];

test('the browser and the server apply the same policy, character for character', () => {
    for (const candidate of CASES) {
        assert.equal(
            browserPolicy(candidate),
            serverPolicy(candidate),
            `the two copies disagree about ${JSON.stringify(candidate)}`
        );
    }
});

test('the policy is twelve characters and four kinds of character', () => {
    assert.equal(PASSWORD_MIN_LENGTH, 12);
    assert.equal(browserPolicy('Passw0rd!2026'), '', 'a password meeting every rule is accepted');

    // The old rule was eight characters and nothing else. For a system holding
    // salaries, IC numbers and bank accounts that is not a password.
    assert.notEqual(browserPolicy('Password1'), '', 'nine characters must no longer pass');
    assert.match(browserPolicy('short'), /at least 12 characters/);
    assert.match(browserPolicy('Password1234'), /a symbol/);
    assert.match(browserPolicy('password1234!'), /an uppercase letter/);
    assert.match(browserPolicy('PASSWORD1234!'), /a lowercase letter/);
    assert.match(browserPolicy('Password!!!!!'), /a number/);
});

test('every place that sets a password goes through it', () => {
    const app = readSource('app.js');
    // The reset/first-login flow and the change-password dialog.
    assert.equal((app.match(/passwordPolicyError\(/g) || []).length >= 3, true);
    assert.doesNotMatch(app, /must be at least 8 characters long/);
    // And the server, which is the copy that decides.
    assert.match(readSource('api/confirm-password-reset.js'), /const policyError = typeof newPassword === 'string' \? passwordPolicyError\(newPassword\)/);
    assert.doesNotMatch(readSource('api/confirm-password-reset.js'), /newPassword\.length < 8/);
});

test('the password a new account is emailed satisfies the policy it will be held to', () => {
    const generate = new Function(`
        ${constantSource('PASSWORD_MIN_LENGTH')}
        const methods = { ${methodSource('generateRandomPassword')} };
        return () => methods.generateRandomPassword();
    `)();

    // Drawing every character from one pool does not guarantee one of each
    // class; at eight characters it frequently produced none at all.
    for (let i = 0; i < 200; i++) {
        const candidate = generate();
        assert.equal(serverPolicy(candidate), '', `generated ${candidate}, which the policy refuses`);
    }
});

test('the form asks for what the policy requires', () => {
    const markup = readSource('index.html');
    assert.doesNotMatch(markup, /minlength="8"/, 'no field may still advertise eight characters');
    assert.match(markup, /:minlength="12"/);
    // The rule is shown, not just enforced after the fact.
    assert.match(markup, /:placeholder="passwordPolicy"/);
    assert.match(readSource('app/computed/access.js'), /passwordPolicy\(\) \{ return PASSWORD_POLICY_TEXT; \}/);
});
