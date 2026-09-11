const test = require('node:test');
const assert = require('node:assert/strict');
const { readSource, methodSource, constantSource } = require('./helpers/sources');

// A code sent to the account's own inbox, required on top of the password for
// the roles that reach payroll, bank details and the money.

test('the roles that hold the money are the roles that are challenged', () => {
    const roles = new Function(`${constantSource('SECOND_FACTOR_ROLES')} return SECOND_FACTOR_ROLES;`)();
    assert.deepEqual(roles, ['Superadmin', 'Director', 'Account']);

    // Staff and Client are deliberately outside it — see the note on the list.
    assert.ok(!roles.includes('Staff'));
    assert.ok(!roles.includes('Client'));
});

test('a challenged role reaches the portal only through the code', () => {
    const login = methodSource('handleLogin');
    const challengeAt = login.indexOf('SECOND_FACTOR_ROLES.includes(role)');
    const completeAt = login.indexOf('await this.completeLogin(loginContext)');

    assert.ok(challengeAt > -1, 'handleLogin must consult the list');
    assert.ok(challengeAt < completeAt, 'the challenge has to come before the session is completed');
    assert.match(login, /await this\.startSignInOtp\(loginContext\);\s*\r?\n\s*return;/);
});

test('the code is tied to the account by a token the server verifies', () => {
    // Not by an email address in the request body — that would let anyone who
    // guessed a password have the code delivered somewhere else.
    assert.match(methodSource('signInOtpPayload'), /await user\.getIdToken\(\)/);

    const context = readSource('api/_passwordResetOtp.js');
    assert.match(context, /await adminAuth\.verifyIdToken\(idToken\)/);
    assert.match(context, /hashResetToken\(`signin:\$\{decoded\.uid\}`\)/);
    // One pending code per account, so a resend replaces the previous one.
    assert.match(context, /source: 'sign-in'/);

    for (const route of ['api/request-login-otp.js', 'api/verify-login-otp.js']) {
        const source = readSource(route);
        assert.match(source, /purpose !== 'password-reset' && purpose !== 'sign-in'/, `${route} must accept both purposes and nothing else`);
        assert.match(source, /resolveSignInContext\(getAdminAuth\(\), req\.body\)/, `${route} must resolve a sign-in from the token`);
    }
});

test('an unanswered challenge cannot be walked around by reloading', () => {
    // The password was accepted before the code was asked for, so Firebase
    // holds a restorable session while the challenge is on screen. Opening a
    // second tab would otherwise restore straight into the portal.
    assert.match(methodSource('startSignInOtp'), /this\.setPendingSecondFactor\(loginContext\?\.firebaseUser\?\.uid \|\| ''\)/);

    const entry = readSource('app.js');
    assert.match(entry, /if \(this\.pendingSecondFactorUid\(\) === firebaseUser\.uid\) \{/);
    assert.match(entry, /await signOut\(auth\)\.catch\(error => console\.error\('Sign-out of an unverified session failed:', error\)\);/);

    // And the marker is cleared on every exit from the challenge, so a stale
    // one cannot lock somebody out of their own account.
    assert.match(methodSource('verifyLoginOtp'), /this\.setPendingSecondFactor\(''\)/);
    assert.match(methodSource('cancelLoginOtp'), /this\.setPendingSecondFactor\(''\)/);
    assert.match(methodSource('handleLogout'), /this\.setPendingSecondFactor\(''\)/);
});

test('abandoning the challenge ends the session it was guarding', () => {
    const cancel = methodSource('cancelLoginOtp');
    assert.match(cancel, /if \(wasSignIn\)/);
    assert.match(cancel, /await signOut\(auth\)/);
    assert.match(cancel, /this\.pendingLoginContext = null/);
});

test('a cleared second factor is recorded against the account', () => {
    const verify = readSource('api/verify-login-otp.js');
    assert.match(verify, /lastSecondFactorAt/);
    assert.match(verify, /if \(purpose === 'sign-in'\)/);
});

test('the sign-in screen asks for the code instead of the password form', () => {
    const markup = readSource('index.html');
    const block = markup.slice(markup.indexOf('SECOND FACTOR'), markup.indexOf('<form v-else @submit.prevent="handleLogin"'));

    assert.ok(block.length > 0, 'the sign-in screen needs the challenge');
    assert.match(block, /v-if="loginOtp\.show && loginOtp\.purpose === 'sign-in'"/);
    assert.match(block, /@click="verifyLoginOtp"/);
    assert.match(block, /@click="cancelLoginOtp"/);
    assert.match(block, /@click="requestLoginOtp"/);
    assert.match(block, /autocomplete="one-time-code"/);
    // The password form is the other branch, so both cannot be on screen.
    assert.match(markup, /<form v-else @submit\.prevent="handleLogin"/);
});
