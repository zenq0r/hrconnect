// Sign in and sign out: password reset and first-login flows, the e-mail OTP
// challenge, session completion, and the signed-in account's own profile.
import {
    db,
    auth,
    doc,
    getDocFromServer,
    setDoc,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    verifyPasswordResetCode,
    confirmPasswordReset,
    checkActionCode,
    applyActionCode
} from "../../firebase-config.js";
import { SEED_ADMIN_EMAILS, createEmailActionFlow } from "../config.js";
import { SECOND_FACTOR_ROLES } from "../constants/rbac.js";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT, passwordPolicyError } from "../constants/password-policy.js";
export const authMethods = {
        // The password a new account is emailed. It has to satisfy the same
        // policy the account will be held to when it changes it, and drawing
        // every character from one pool does not guarantee that — a short
        // random string is quite capable of containing no digit at all. One
        // character is taken from each required class first, and the shuffle
        // keeps those four out of a predictable position.
        generateRandomPassword(length = 16) {
            const classes = [
                'ABCDEFGHJKLMNPQRSTUVWXYZ',
                'abcdefghijkmnpqrstuvwxyz',
                '23456789',
                '!@#$%^&*?-_'
            ];
            const pool = classes.join('');
            const pick = (chars) => chars.charAt(Math.floor(Math.random() * chars.length));
            const size = Math.max(PASSWORD_MIN_LENGTH, Number(length) || 0);
            const characters = classes.map(pick);
            while (characters.length < size) characters.push(pick(pool));
            for (let i = characters.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [characters[i], characters[j]] = [characters[j], characters[i]];
            }
            return characters.join('');
        },

        isStaffEmail(email) {
            if (!email) return false;
            const normalizedEmail = email.toLowerCase().trim();
            if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) return false;
            const emailDomain = normalizedEmail.split('@')[1];
            return this.allowedStaffDomains.includes(emailDomain);
        },
        isSeedAdminEmail(email) {
            return SEED_ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());
        },
        approvedStaffDomainsLabel() {
            return this.allowedStaffDomains.map(domain => `@${domain}`).join(' or ');
        },
        // The two directions of one rule: a staff or management login must be on
        // an approved company domain, and a Client login must NOT be. Client
        // access used to be domain-neutral, which let a company address be
        // registered as an external customer's login - never a security hole,
        // since the role still decides which portal admits it, but a confusing
        // thing to find in the directory and an easy way to mis-provision
        // somebody. A Client is by definition somebody outside the company, so
        // their sign-in address is too.
        isPortalEmailAllowed(email, role) {
            return role === 'Client' ? !this.isStaffEmail(email) : this.isStaffEmail(email);
        },
        // Why a given address was refused, phrased for the side it failed on.
        // Telling a Client that "Staff sign-in requires @zenqor.com.my" would
        // read as an instruction to go and get one.
        portalEmailRejectionMessage(role) {
            return role === 'Client'
                ? `Client access cannot use a company address (${this.approvedStaffDomainsLabel()}). Register the client's own email instead.`
                : `Staff and Management sign-in requires ${this.approvedStaffDomainsLabel()}.`;
        },
        // A locked account keeps a valid Firebase credential and a valid portal
        // record - the lock is this portal's own gate, so all three entry points
        // have to honour it: the interactive sign-in, the restored session, and
        // the live directory listener for a session locked while it is open.
        // Returns the message to show, or '' when the account is not locked.
        // The seed administrator is exempt: it is the account that unlocks
        // everybody else, and locking it out would strand the whole portal.
        accountLockedSignInMessage(userData, email) {
            if (this.isSeedAdminEmail(email)) return '';
            if (userData?.accessLocked !== true) return '';
            const reason = String(userData?.accessLockReason || '').trim();
            return `Your portal access is locked. Please contact your administrator.${reason ? ` Reason: ${reason}` : ''}`;
        },
        // A realtime listener is NOT proof that access was revoked. Firestore
        // delivers a cached snapshot before the server round-trip, and a listener
        // is denied whenever the ID token it was opened with has gone stale —
        // which happens on every password change, because updatePassword() bumps
        // the account's validSince and invalidates previously issued tokens. A
        // rules deployment propagating does the same thing for a few seconds.
        // Signing the user out and telling them their access "has been removed"
        // on any of those signals locks out perfectly valid accounts, and it is
        // exactly what a brand-new client hits: sign in with the temporary
        // password, change it as required, and get thrown out claiming an admin
        // removed them. So confirm against the server before revoking.
        //
        // Returns true only when the account genuinely has no portal access:
        // either its users/{uid} record is gone, or its role no longer permits
        // sign-in. A FRESH token that is still refused is itself conclusive —
        // that is what a real revocation looks like once the doc is deleted,
        // because the read rule can no longer resolve the account's role.
        async isPortalAccessTrulyRevoked(reason) {
            const user = auth.currentUser;
            if (!user) return false;
            try {
                // Re-mint the token first: the listener that raised this may have
                // been holding the pre-password-change one.
                await user.getIdToken(true);
                // A listener can first emit its local cache while the freshly
                // minted token is still settling. A cached miss is not evidence
                // that an administrator removed the account, so this decisive
                // check must go to Firestore's server rather than falling back
                // to persistence. Network failures are handled below as
                // transient and keep the valid session open.
                const snapshot = await getDocFromServer(doc(db, 'users', user.uid));
                if (!snapshot.exists()) return !this.isSeedAdminEmail(user.email);
                return !this.isPortalEmailAllowed(user.email, snapshot.data()?.role || '');
            } catch (error) {
                // Denied again holding a token minted seconds ago — the rules
                // really do refuse this account now.
                if (error?.code === 'permission-denied') return !this.isSeedAdminEmail(user.email);
                // Anything else (offline, timeout, backend hiccup) is transient and
                // must never end a valid session.
                console.warn(`Could not confirm portal access (${reason}); keeping the session:`, error);
                return false;
            }
        },
        async revokePortalAccessIfConfirmed(reason) {
            if (await this.isPortalAccessTrulyRevoked(reason)) this.revokeCurrentPortalAccess();
        },
        // A Staff Portal LOCK ends the session the same disciplined way a
        // revocation does. The listener's snapshot may be the cached one, so the
        // lock is re-read from the server on a freshly minted token before the
        // session is ended - an account unlocked seconds ago must not be thrown
        // out by a stale copy that still reads locked, and a network failure
        // must never end a valid session at all. Returns the message to show,
        // or '' when the account is not (or no longer) locked.
        async isPortalAccessTrulyLocked() {
            const user = auth.currentUser;
            if (!user || this.isSeedAdminEmail(user.email)) return '';
            try {
                await user.getIdToken(true);
                const snapshot = await getDocFromServer(doc(db, 'users', user.uid));
                // A missing record is a revocation, not a lock. Leave that call
                // to isPortalAccessTrulyRevoked(), which the listener path that
                // detects a missing record already makes.
                if (!snapshot.exists()) return '';
                return this.accountLockedSignInMessage(snapshot.data(), user.email);
            } catch (error) {
                console.warn('Could not confirm a portal access lock; keeping the session:', error);
                return '';
            }
        },
        async revokePortalAccessIfLocked() {
            // The listener re-fires on every snapshot; without this the confirming
            // read would be issued once per snapshot while the sign-out settles.
            if (this.portalLockCheckInProgress || this.portalAccessRevocationInProgress) return;
            this.portalLockCheckInProgress = true;
            try {
                const message = await this.isPortalAccessTrulyLocked();
                if (message) this.revokeCurrentPortalAccess(message);
            } finally {
                this.portalLockCheckInProgress = false;
            }
        },
        async revokeCurrentPortalAccess(message = 'Your portal access has been removed. Please contact your administrator.') {
            if (this.portalAccessRevocationInProgress) return;
            this.portalAccessRevocationInProgress = true;
            this.intentionalLogoutInProgress = false;
            this.loginError = message;
            this.stopPresenceTracking();
            this.stopClientStatusClock();
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Unable to end a revoked portal session:', error);
            } finally {
                this.portalAccessRevocationInProgress = false;
            }
        },
        openForgotPasswordFlow() {
            this.forgotPasswordFlow = { active: true, email: this.loginForm.email || '', loading: false, sent: false, error: '' };
        },
        exitForgotPasswordFlow() {
            this.forgotPasswordFlow = { active: false, email: '', loading: false, sent: false, error: '' };
        },
        async submitForgotPasswordRequest() {
            this.forgotPasswordFlow.error = '';
            if (!this.forgotPasswordFlow.email) { this.forgotPasswordFlow.error = 'Please enter your email address.'; return; }
            this.forgotPasswordFlow.loading = true;
            try {
                const response = await fetch('/api/request-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.forgotPasswordFlow.email })
                });
                if (!response.ok) throw new Error('request-failed');
                this.forgotPasswordFlow.sent = true;
            } catch (error) {
                console.error('Password reset request failed:', error);
                this.forgotPasswordFlow.error = 'Failed to send password reset email. Please try again shortly.';
            } finally {
                this.forgotPasswordFlow.loading = false;
            }
        },
        async checkPasswordResetLink() {
            const params = new URLSearchParams(window.location.search);
            const firebaseMode = params.get('mode');
            const firebaseOobCode = params.get('oobCode');
            const legacyToken = params.get('resetToken');
            if (!firebaseOobCode && !legacyToken) return;

            // Firebase sends mode + oobCode to every custom action URL. Retain
            // the code only in Vue state, then remove it from the browser address
            // bar so it cannot be copied into history, screenshots, or referrers.
            const isFirebaseAction = Boolean(firebaseMode && firebaseOobCode);
            this.passwordResetFlow = createEmailActionFlow({
                active: true,
                source: isFirebaseAction ? 'firebase' : 'legacy',
                mode: isFirebaseAction ? firebaseMode : 'resetPassword',
                oobCode: isFirebaseAction ? firebaseOobCode : legacyToken
            });
            window.history.replaceState({}, '', window.location.pathname);

            try {
                if (isFirebaseAction) {
                    if (firebaseMode === 'resetPassword') {
                        this.passwordResetFlow.email = await verifyPasswordResetCode(auth, firebaseOobCode);
                        this.passwordResetFlow.displayName = this.accountDisplayName(this.passwordResetFlow.email);
                        this.passwordResetFlow.companyName = this.company?.name || 'Zenqor Technologies';
                        this.passwordResetFlow.valid = true;
                        await this.startPasswordResetOtp();
                        return;
                    }

                    if (firebaseMode === 'verifyEmail' || firebaseMode === 'recoverEmail') {
                        const actionInfo = await checkActionCode(auth, firebaseOobCode);
                        this.passwordResetFlow.email = actionInfo?.data?.email || '';
                        this.passwordResetFlow.previousEmail = actionInfo?.data?.previousEmail || '';
                        this.passwordResetFlow.valid = true;
                        return;
                    }

                    this.passwordResetFlow.error = 'This account action is not supported by the Zenqor Portal.';
                    return;
                }

                const response = await fetch('/api/verify-reset-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: legacyToken })
                });
                const data = await response.json();
                this.passwordResetFlow.valid = Boolean(data.valid);
                if (data.valid) {
                    this.passwordResetFlow.email = data.email;
                    this.passwordResetFlow.displayName = data.displayName || this.accountDisplayName(data.email);
                    this.passwordResetFlow.companyName = data.companyName || this.company?.name || 'Zenqor Technologies';
                    await this.startPasswordResetOtp();
                }
                else this.passwordResetFlow.error = data.reason || 'This reset link is invalid. Please request a new one.';
            } catch (error) {
                console.error('Email action link verification failed:', error);
                this.passwordResetFlow.valid = false;
                this.passwordResetFlow.error = 'This link is invalid or has expired. Please request a new one.';
            } finally {
                this.passwordResetFlow.verifying = false;
            }
        },
        async submitPasswordReset() {
            const flow = this.passwordResetFlow;
            flow.error = '';
            if (flow.mode === 'resetPassword' && !flow.otpVerified) { flow.error = 'Verify the 6-digit code sent to your email before setting a new password.'; return; }
            if (flow.mode === 'firstLogin' && !flow.temporaryPassword) { flow.error = 'Enter the password used for this sign-in to continue.'; return; }
            const policyError = passwordPolicyError(flow.newPassword);
            if (policyError) { flow.error = policyError; return; }
            if (flow.newPassword !== flow.confirmPassword) { flow.error = 'Passwords do not match.'; return; }
            flow.loading = true;
            try {
                if (flow.mode === 'firstLogin') {
                    const context = this.pendingLoginContext;
                    if (!context?.firebaseUser?.email) throw new Error('Your temporary sign-in session has expired. Please sign in again.');
                    const credential = EmailAuthProvider.credential(context.firebaseUser.email, flow.temporaryPassword);
                    await reauthenticateWithCredential(context.firebaseUser, credential);
                    await updatePassword(context.firebaseUser, flow.newPassword);
                    // updatePassword() bumps validSince, so every token issued
                    // before this instant is now rejected. Mint a new one before
                    // the write below and before completeLogin() opens listeners,
                    // or this first sign-in ends in a false "access removed".
                    await context.firebaseUser.getIdToken(true).catch(() => {});
                    await setDoc(doc(db, 'users', context.firebaseUser.uid), {
                        mustChangePassword: false,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                    context.userData = { ...(context.userData || {}), mustChangePassword: false };
                    context.mustChangePassword = false;
                    flow.email = context.firebaseUser.email;
                    flow.displayName = context.name || flow.displayName;
                    flow.companyName = this.company?.name || flow.companyName || 'Zenqor Technologies';
                    flow.newPassword = '';
                    flow.confirmPassword = '';
                    flow.temporaryPassword = '';
                    this.passwordResetFlow = createEmailActionFlow();
                    this.pendingLoginContext = null;
                    window.history.replaceState({}, '', '/');
                    await this.completeLogin(context);
                } else if (flow.source === 'firebase') {
                    await confirmPasswordReset(auth, this.passwordResetFlow.oobCode, flow.newPassword);
                    flow.success = true;
                    flow.successTitle = 'Password updated';
                    flow.successDescription = 'Your password has been updated. Please sign in with your new password.';
                } else {
                    const response = await fetch('/api/confirm-password-reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: flow.oobCode, newPassword: flow.newPassword })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Unable to reset your password.');
                    flow.success = true;
                    flow.successTitle = 'Password updated';
                    flow.successDescription = 'Your password has been updated. Please sign in with your new password.';
                }
                flow.newPassword = '';
                flow.confirmPassword = '';
                flow.temporaryPassword = '';
            } catch (error) {
                console.error('Password reset confirmation failed:', error);
                flow.error = error?.code === 'auth/weak-password'
                    ? `Please choose a stronger password. ${PASSWORD_POLICY_TEXT}`
                    : (error.message || 'Unable to reset your password. Please try again.');
            } finally {
                flow.loading = false;
            }
        },
        async completeFirebaseEmailAction() {
            this.passwordResetFlow.error = '';
            this.passwordResetFlow.loading = true;
            try {
                await applyActionCode(auth, this.passwordResetFlow.oobCode);
                this.passwordResetFlow.success = true;
                this.passwordResetFlow.successTitle = this.passwordResetFlow.mode === 'recoverEmail'
                    ? 'Email address restored'
                    : 'Email address verified';
                this.passwordResetFlow.successDescription = this.passwordResetFlow.mode === 'recoverEmail'
                    ? 'Your account email address has been restored. You can now sign in securely.'
                    : 'Your email address is now verified. Thank you for confirming your account.';
            } catch (error) {
                console.error('Firebase email action confirmation failed:', error);
                this.passwordResetFlow.error = 'This link is invalid or has expired. Please request a new one.';
            } finally {
                this.passwordResetFlow.loading = false;
            }
        },
        exitPasswordResetFlow() {
            const firstTimeAccess = this.passwordResetFlow.mode === 'firstLogin';
            this.passwordResetFlow = createEmailActionFlow();
            this.pendingLoginContext = null;
            window.history.replaceState({}, '', '/');
            // A first-time user is already authenticated with a temporary
            // credential. Leaving this screen must not leave that session
            // active without completing the required password step.
            if (firstTimeAccess) signOut(auth).catch(error => console.warn('Unable to close temporary session:', error));
        },
        accountDisplayName(email) {
            const localPart = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
            return localPart ? localPart.replace(/\b\w/g, char => char.toUpperCase()) : 'Zenqor Portal User';
        },
        openFirstTimePasswordFlow(loginContext) {
            this.pendingLoginContext = loginContext;
            this.passwordResetFlow = createEmailActionFlow({
                active: true,
                source: 'first-login',
                mode: 'firstLogin',
                email: loginContext.firebaseUser.email,
                displayName: loginContext.name || this.accountDisplayName(loginContext.firebaseUser.email),
                companyName: this.company?.name || 'Zenqor Technologies',
                verifying: false,
                valid: true
            });
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.history.replaceState({}, '', '/auth/action');
        },
        async startPasswordResetOtp() {
            const flow = this.passwordResetFlow;
            if (!flow?.valid || flow.mode !== 'resetPassword' || !flow.email || !flow.oobCode) {
                flow.error = 'This reset link is no longer valid. Please request a new one.';
                return;
            }
            // Guards against a duplicate auto-trigger — e.g. a corporate email
            // scanner (Safe Links) opening the reset link once before the user's
            // real click — which would otherwise fire two OTP requests back to
            // back and surface a confusing 429 on the second one.
            if (this.loginOtp.sending || this.loginOtp.cooldownSeconds > 0) return;
            flow.error = '';
            // `sending` must start false: requestLoginOtp() owns that flag and
            // bails out early when it is already set. Priming it to true here
            // would trip that in-flight guard and the request would never leave
            // the browser, leaving the button stuck on "Sending…" forever.
            this.loginOtp = { show: true, code: '', error: '', sending: false, verifying: false, email: flow.email, purpose: 'password-reset', cooldownSeconds: 0 };
            await this.$nextTick();
            await this.requestLoginOtp();
        },
        startLoginOtpCooldown(seconds) {
            clearInterval(this.loginOtpCooldownTimer);
            this.loginOtp.cooldownSeconds = seconds;
            this.loginOtpCooldownTimer = setInterval(() => {
                if (this.loginOtp.cooldownSeconds <= 1) {
                    clearInterval(this.loginOtpCooldownTimer);
                    this.loginOtp.cooldownSeconds = 0;
                } else {
                    this.loginOtp.cooldownSeconds -= 1;
                }
            }, 1000);
        },

        async handleLogin() {
            this.loginError = '';
            // A new sign-in is a new session. Do not let a previous successful
            // logout mask a real access error during this attempt.
            this.intentionalLogoutInProgress = false;
            // Never reveal a previous workspace frame while a new sign-in is
            // being validated. The navigation reopens only after the session
            // is fully ready.
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            if (this.authView === 'staff' && !this.isStaffEmail(this.loginForm.email)) {
                this.loginError = `Staff and Management sign-in requires ${this.approvedStaffDomainsLabel()}.`;
                return;
            }
            this.loginLoading = true;
            this.interactiveLoginInProgress = true;
            try {
                const userCredential = await signInWithEmailAndPassword(auth, this.loginForm.email, this.loginForm.password);
                const firebaseUser = userCredential.user;
                const userData = await this.loadOrMigrateUserMetadata(firebaseUser);
                const isSeedAdmin = this.isSeedAdminEmail(firebaseUser.email);

                if (!userData && !isSeedAdmin) {
                    await signOut(auth);
                    this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                    this.loginLoading = false;
                    return;
                }

                const lockedMessage = this.accountLockedSignInMessage(userData, firebaseUser.email);
                if (lockedMessage) {
                    await signOut(auth);
                    this.loginError = lockedMessage;
                    this.loginLoading = false;
                    return;
                }

                let role = userData?.role || 'Staff';
                let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;

                const mustChangePassword = userData?.mustChangePassword === true;
                if (isSeedAdmin) role = 'Superadmin';
                if (!this.isPortalEmailAllowed(firebaseUser.email, role)) {
                    await signOut(auth);
                    this.loginError = this.portalEmailRejectionMessage(role);
                    this.loginLoading = false;
                    return;
                }
                if (this.authView === 'client' && role !== 'Client') {
                    await signOut(auth);
                    this.loginError = 'This is a staff account. Please use "Company Staff" sign in instead.';
                    this.loginLoading = false;
                    return;
                }
                if (this.authView === 'staff' && role === 'Client') {
                    await signOut(auth);
                    this.loginError = 'This is a client account. Please use "Client Portal" sign in instead.';
                    this.loginLoading = false;
                    return;
                }

                const loginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                if (mustChangePassword) {
                    this.loginLoading = false;
                    this.openFirstTimePasswordFlow(loginContext);
                    return;
                }

                // A password is one factor. For the roles that reach payroll,
                // bank details and the money, it is not enough on its own: a
                // code goes to the account's own inbox and the portal does not
                // open until it comes back.
                if (SECOND_FACTOR_ROLES.includes(role)) {
                    this.loginLoading = false;
                    await this.startSignInOtp(loginContext);
                    return;
                }

                await this.completeLogin(loginContext);
            } catch (error) {
                console.error('Sign-in failed:', error);
                // The credentials were accepted the moment signInWithEmailAndPassword
                // resolved, so a later Firestore failure is a connection problem, not a
                // bad password. Saying "invalid credentials" there sends the user off
                // retyping a password that was never wrong.
                const errorCode = String(error?.code || '');
                const isCredentialFailure = errorCode.startsWith('auth/');
                const isClientProvisioningFailure = errorCode.startsWith('client/');
                // A Staff Portal lock disables the Authentication account, so
                // sign-in now fails here rather than at the Firestore check
                // below it. Reporting that as a wrong password would send the
                // person off resetting a password that was never the problem.
                if (errorCode === 'auth/user-disabled') {
                    this.loginError = 'Your portal access is locked. Please contact your administrator.';
                } else if (isClientProvisioningFailure) {
                    this.loginError = error.message;
                } else {
                    this.loginError = isCredentialFailure
                        ? 'Invalid email or password credentials / System Error.'
                        : 'We could not reach the portal to finish signing you in. Please check your connection and try again.';
                }
                this.isLoggedIn = false;
                if (auth.currentUser) await signOut(auth).catch(signOutError => console.error('Sign-out after failed login setup failed:', signOutError));
                this.loginLoading = false;
            } finally {
                this.interactiveLoginInProgress = false;
            }
        },
        async requestLoginOtp() {
            // Re-entrancy guard: ignore a resend click (or a second automatic
            // trigger) fired while a request is already in flight or while the
            // server-side cooldown is still active — both would otherwise just
            // bounce off the 429 below.
            if (this.loginOtp.sending || this.loginOtp.cooldownSeconds > 0) return;
            this.loginOtp.sending = true;
            this.loginOtp.error = '';
            try {
                const flow = this.passwordResetFlow;
                let body;
                if (this.loginOtp.purpose === 'sign-in') {
                    body = await this.signInOtpPayload();
                } else if (this.loginOtp.purpose === 'password-reset' && flow?.valid && flow.oobCode) {
                    body = { purpose: 'password-reset', resetSource: flow.source, resetToken: flow.oobCode };
                } else {
                    throw new Error('Your password reset session has expired. Please request a new reset link.');
                }
                const resp = await Promise.race([
                    fetch('/api/request-login-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    }),
                    this.timeoutPromise(15000, 'Sending the verification code is taking too long. Please try again.')
                ]);
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.error || 'Failed to send verification code.');
                this.startLoginOtpCooldown(60);
            } catch (error) {
                console.error('Request login OTP failed:', error);
                this.loginOtp.error = error.message || 'Unable to send verification code. Try again.';
                // The server already rejected this as a duplicate — start the same
                // cooldown locally so the button reflects the wait instead of
                // looking clickable again and inviting another 429.
                if (error.message && /wait before requesting/i.test(error.message)) this.startLoginOtpCooldown(60);
            } finally {
                this.loginOtp.sending = false;
            }
        },
        // Rejects after `ms` milliseconds so an await'd call that would otherwise hang
        // forever (a stalled fetch, an offline Firestore read waiting for reconnect) is
        // instead bounded — callers race this against the real work via Promise.race.
        timeoutPromise(ms, message) {
            return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
        },
        async verifyLoginOtp() {
            if (!this.loginOtp.code || this.loginOtp.code.trim().length !== 6) { this.loginOtp.error = 'Enter the 6-digit code from your email.'; return; }
            this.loginOtp.verifying = true;
            this.loginOtp.error = '';
            try {
                const flow = this.passwordResetFlow;
                const isSignIn = this.loginOtp.purpose === 'sign-in';
                let body;
                if (isSignIn) {
                    body = await this.signInOtpPayload();
                } else if (this.loginOtp.purpose === 'password-reset' && flow?.valid && flow.oobCode) {
                    body = { purpose: 'password-reset', resetSource: flow.source, resetToken: flow.oobCode };
                } else {
                    throw new Error('Your password reset session has expired. Please request a new reset link.');
                }
                const resp = await fetch('/api/verify-login-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...body, code: this.loginOtp.code.trim() })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.valid) throw new Error(data.error || 'Invalid or expired code.');
                if (isSignIn) {
                    this.setPendingSecondFactor('');
                    const context = this.pendingLoginContext;
                    this.pendingLoginContext = null;
                    clearInterval(this.loginOtpCooldownTimer);
                    this.loginOtp = { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 };
                    if (!context?.firebaseUser) throw new Error('Your sign-in session has expired. Please sign in again.');
                    this.loginLoading = true;
                    await this.completeLogin(context);
                    return;
                }
                flow.otpVerified = true;
                flow.error = '';
                clearInterval(this.loginOtpCooldownTimer);
                this.loginOtp = { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 };
            } catch (error) {
                console.error('Verify login OTP failed:', error);
                this.loginOtp.error = error.message || 'Verification failed.';
                this.loginOtp.verifying = false;
            }
        },
        async cancelLoginOtp() {
            const wasSignIn = this.loginOtp.purpose === 'sign-in';
            clearInterval(this.loginOtpCooldownTimer);
            this.loginOtp = { show: false, code: '', error: '', sending: false, verifying: false, email: '', purpose: '', cooldownSeconds: 0 };
            if (this.passwordResetFlow?.active && this.passwordResetFlow.mode === 'resetPassword') {
                this.passwordResetFlow.error = 'Verification is required before you can set a new password.';
            }
            // Abandoning the challenge abandons the sign-in. The password was
            // accepted, so a Firebase session exists at this point and would
            // otherwise be restored on the next page load without the code ever
            // having been entered.
            if (wasSignIn) {
                this.setPendingSecondFactor('');
                this.pendingLoginContext = null;
                this.loginError = 'Sign-in was cancelled before the verification code was confirmed.';
                if (auth.currentUser) {
                    this.intentionalLogoutInProgress = true;
                    await signOut(auth).catch(error => console.error('Sign-out after an abandoned verification failed:', error));
                }
            }
        },

        // The second factor at sign-in, for the roles in SECOND_FACTOR_ROLES.
        //
        // Worth being precise about what this is: the password has already been
        // accepted by Firebase when this runs, so the account holds a session
        // either way. What the code decides is whether the PORTAL opens. Someone
        // driving the Firebase SDK by hand with a stolen password is not stopped
        // by it — stopping that needs the code to gate a custom claim the rules
        // then require, which locks out every open session on the day it ships
        // and is an operational decision, not a code one. What this does stop is
        // the realistic case: a leaked or phished password typed into the real
        // portal by someone who does not have the inbox.
        async startSignInOtp(loginContext) {
            this.pendingLoginContext = loginContext;
            const email = loginContext?.firebaseUser?.email || '';
            // The password was accepted, so Firebase already holds a session —
            // and a session is restorable. Without this marker, opening a second
            // tab while the code is still unanswered would restore that session
            // straight into the portal, and the challenge would be decoration.
            // It is cleared when the code is confirmed, when the challenge is
            // abandoned, and on any sign-out.
            this.setPendingSecondFactor(loginContext?.firebaseUser?.uid || '');
            this.loginOtp = { show: true, code: '', error: '', sending: false, verifying: false, email, purpose: 'sign-in', cooldownSeconds: 0 };
            await this.$nextTick();
            await this.requestLoginOtp();
        },

        setPendingSecondFactor(uid) {
            try {
                if (uid) localStorage.setItem('zqPendingSecondFactor', uid);
                else localStorage.removeItem('zqPendingSecondFactor');
            } catch (error) {
                // Private browsing, or storage disabled entirely. The challenge
                // still holds in this tab; it just cannot be enforced across a
                // second one.
                console.warn('Could not record the pending verification:', error);
            }
        },

        pendingSecondFactorUid() {
            try {
                return localStorage.getItem('zqPendingSecondFactor') || '';
            } catch (error) {
                return '';
            }
        },

        // The token is proof of who is asking. It is minted by Firebase after
        // the password was accepted, and the server re-verifies it rather than
        // trusting any address in the request body.
        async signInOtpPayload() {
            const user = auth.currentUser;
            if (!user) throw new Error('Your sign-in session has expired. Please sign in again.');
            return { purpose: 'sign-in', idToken: await user.getIdToken() };
        },
        async completeLogin({ firebaseUser, userData, role, name, photo, mustChangePassword }) {
            if (mustChangePassword) {
                this.isLoggedIn = false;
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                this.openFirstTimePasswordFlow({ firebaseUser, userData, role, name, photo, mustChangePassword });
                this.loginLoading = false;
                return;
            }
            this.userProfile = { name: name, email: firebaseUser.email, role: role, uid: firebaseUser.uid, photo: photo, mustChangePassword, themePreference: userData?.themePreference || 'light' };
            this.applyDarkModePreference();
            this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
            this.startIdleTimeoutWatch();
            await this.syncUserClaims();

            // Fetch the portal's own markup before the portal is shown, so the
            // first frame after sign-in is the workspace and not an empty page.
            await this.ensurePortalViews(role);

            this.resetAllForms(); this.isLoggedIn = true; this.desktopSidebarOpen = false; this.mobileMenuOpen = false;
            await this.logAudit('LOGIN', `User logged in with role ${this.getRoleDisplayName(role)}`);
            this.showNotify(`Welcome back (${this.getRoleDisplayName(role)}): ${name}`);
            this.currentTab = role === 'Client' ? 'client-portal' : 'dashboard';
            window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
            this.playWelcomeGreeting();
            this.loginLoading = false;
            this.initFirebaseRealtime().catch(error => {
                console.error('Realtime data initialization failed after login:', error);
                this.portalDataReady = false;
            });
            this.startPresenceTracking().catch(error => console.error('Presence tracking failed after login:', error));
            this.refreshDashboardCharts();
        },

        async handleLogout() {
            this.logoutConfirm = false;
            // Mark this before signOut() so onAuthStateChanged's signed-out
            // branch knows this is user/idle initiated, not an access revocation.
            this.intentionalLogoutInProgress = true;
            this.setPendingSecondFactor('');
            this.loginError = '';
            try { await this.logAudit('LOGOUT', 'User logged out'); } catch (error) { console.error('Audit log failed during logout:', error); }
            try { await this.setCurrentPresence(false); } catch (error) { console.error('Presence update failed during logout:', error); }
            this.stopPresenceTracking();
            try {
                await signOut(auth);
            } catch (error) {
                // Firebase did not confirm the logout, so a later auth event
                // must not be mistaken for this user-initiated attempt.
                this.intentionalLogoutInProgress = false;
                console.error('Firebase sign-out failed:', error);
                this.showNotify('Sign-out ran into an issue, but your local session has been cleared. Close this tab if you are on a shared device.');
            } finally {
                this.destroyDashboardCharts();
                this.isLoggedIn = false; this.loginLoading = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false; this.portalDataReady = false; this.portalDataReadyPromise = null; this.userProfile = { name: '', email: '', role: '', photo: '' };
                this.mountedViews = []; this.viewError = '';
                this.resetAllForms(); this.currentTab = 'dashboard'; this.loginForm = { email: '', password: '' }; this.searchQuery = ''; this.authView = 'landing';
                this.postLogoutChoice = true;
            }
        },
        stayOnPortal() {
            this.postLogoutChoice = false;
        },
        goToMainSite() {
            this.postLogoutChoice = false;
            window.location.href = 'https://www.zenqor.com.my';
        },

        async handleChangePassword() {
            this.changePasswordModal.error = '';
            const { currentPassword, newPassword, confirmPassword } = this.changePasswordModal;
            if (newPassword !== confirmPassword) { this.changePasswordModal.error = 'New passwords do not match.'; return; }
            const policyError = passwordPolicyError(newPassword);
            if (policyError) { this.changePasswordModal.error = policyError; return; }
            this.changePasswordModal.loading = true;
            try {
                const user = auth.currentUser;
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);
                // Same validSince bump as the first-login flow: refresh before the
                // write, so the open listeners keep a token the rules accept.
                await user.getIdToken(true).catch(() => {});
                await setDoc(doc(db, "users", user.uid), { mustChangePassword: false }, { merge: true });
                this.userProfile.mustChangePassword = false;
                this.changePasswordModal.show = false; this.changePasswordModal.required = false; this.changePasswordModal.currentPassword = ''; this.changePasswordModal.newPassword = ''; this.changePasswordModal.confirmPassword = '';
                this.logAudit('UPDATE', 'User changed their password'); this.showNotify('Password updated successfully!');
            } catch (error) { this.changePasswordModal.error = 'Current password is incorrect or System error.'; } finally { this.changePasswordModal.loading = false; }
        },

        async saveMyProfile() {
            try {
                if (!this.userProfile.email) return;
                this.userProfile.name = this.toOfficialUppercase(this.userProfile.name);
                const userRef = doc(db, "users", this.userProfile.uid);
                await setDoc(userRef, { name: this.userProfile.name, email: this.userProfile.email, photo: this.userProfile.photo }, { merge: true });
                this.logAudit('UPDATE', `User updated own profile: ${this.userProfile.email}`); this.showNotify('Your profile has been updated successfully!');
            } catch (error) { this.showNotify('Error updating profile.'); }
        },
        async handleProfilePhotoUpload(event) {
            const file = event.target.files && event.target.files[0];
            this.profilePhotoUpload.error = '';
            if (!file) return;
            if (!this.userProfile.uid) { this.profilePhotoUpload.error = 'Please sign in again before uploading a photo.'; return; }
            this.profilePhotoUpload.loading = true;
            try {
                const photoUrl = await this.prepareImageAttachment(file, 120 * 1024, 720);
                await setDoc(doc(db, 'users', this.userProfile.uid), { photo: photoUrl }, { merge: true });
                this.userProfile.photo = photoUrl;
                await this.syncCurrentOwnerPhoto();
                this.logAudit('UPDATE', 'Uploaded profile photo');
                this.showNotify('Profile photo uploaded and saved successfully.');
            } catch (error) {
                console.error('Profile photo upload failed:', error);
                this.profilePhotoUpload.error = this.getUploadErrorMessage(error);
            } finally {
                this.profilePhotoUpload.loading = false;
                event.target.value = '';
            }
        }
};