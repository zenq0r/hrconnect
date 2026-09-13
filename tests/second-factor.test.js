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
    // One function decides, so no path can skip it by calling completeLogin()
    // directly — which is exactly how the first-login password change used to
    // open the portal without a code.
    const finish = methodSource('finishSignIn');
    const challengeAt = finish.indexOf('SECOND_FACTOR_ROLES.includes(loginContext?.role)');
    const completeAt = finish.indexOf('await this.completeLogin(loginContext)');
    assert.ok(challengeAt > -1 && challengeAt < completeAt, 'the challenge has to come before the session is completed');
    assert.match(finish, /await this\.startSignInOtp\(loginContext\);\s*\r?\n\s*return;/);

    // Every entry point goes through it. The only one allowed to skip the
    // challenge is the one that has just confirmed the code.
    assert.match(methodSource('handleLogin'), /await this\.finishSignIn\(loginContext\)/);
    assert.match(methodSource('submitPasswordReset'), /await this\.finishSignIn\(context\)/);
    assert.match(methodSource('verifyLoginOtp'), /await this\.finishSignIn\(context, \{ secondFactorCleared: true \}\)/);

    const auth = readSource('app/methods/auth.js');
    const directCompletes = (auth.match(/await this\.completeLogin\(/g) || []).length;
    assert.equal(directCompletes, 1, 'completeLogin() may only be called from finishSignIn()');
});

test('a sign-in that fails after the password was accepted does not stay half-open', () => {
    const finish = methodSource('finishSignIn');
    assert.match(finish, /catch \(error\) \{[\s\S]*await this\.abandonSignIn\(/);

    const abandon = methodSource('abandonSignIn');
    assert.match(abandon, /this\.loginLoading = false;/);
    assert.match(abandon, /this\.setPendingSecondFactor\(''\)/);
    assert.match(abandon, /await signOut\(auth\)/);
    // The reason has to survive the sign-out: marking it intentional would have
    // the auth observer clear loginError before it rendered.
    for (const name of ['finishSignIn', 'cancelLoginOtp', 'abandonSignIn']) {
        assert.doesNotMatch(methodSource(name), /intentionalLogoutInProgress = true/);
    }
});

test('the code is tied to the account by a token the server verifies', () => {
    // Not by an email address in the request body — that would let anyone who
    // guessed a password have the code delivered somewhere else.
    assert.match(methodSource('loginOtpPayload'), /return \{ purpose: 'sign-in', idToken: await user\.getIdToken\(\) \};/);

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
    assert.match(methodSource('abandonSignIn'), /this\.setPendingSecondFactor\(''\)/);
    assert.match(methodSource('handleLogout'), /this\.setPendingSecondFactor\(''\)/);
});

test('abandoning the challenge ends the session it was guarding', () => {
    assert.match(methodSource('cancelLoginOtp'), /if \(wasSignIn\) await this\.abandonSignIn\(/);
    const abandon = methodSource('abandonSignIn');
    assert.match(abandon, /await signOut\(auth\)/);
    assert.match(abandon, /this\.pendingLoginContext = null/);
});

test('a cleared second factor is recorded against the account', () => {
    const verify = readSource('api/verify-login-otp.js');
    // Inside the transaction that spends the code, so one is never without the other.
    const transaction = verify.slice(verify.indexOf('db.runTransaction('), verify.indexOf('if (!result.valid)'));
    assert.match(transaction, /if \(purpose === 'sign-in'\) \{\s*transaction\.set\(db\.collection\('users'\)\.doc\(reset\.uid\), \{ lastSecondFactorAt: usedAt \}, \{ merge: true \}\);/);
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
