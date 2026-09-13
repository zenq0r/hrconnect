// Portal access administration: user records, the Staff Portal action buttons,
// access requests, backup and company settings.
import {
    db,
    auth,
    initializeApp,
    deleteApp,
    getAuth,
    collection,
    doc,
    setDoc,
    deleteDoc,
    createUserWithEmailAndPassword,
    signOut
} from "../../firebase-config.js";
import { PORTAL_URL, SUPPORT_EMAIL } from "../config.js";
import { RBAC_ROLES, MODULE_LABELS, MODULE_ACTIONS, STAFF_PORTAL_ACTIONS, STAFF_PORTAL_REQUEST_ACTIONS, moduleActionFor } from "../constants/rbac.js";
export const adminUserMethods = {

        // Firebase's own messages read "Firebase: Error (auth/invalid-email)." —
        // accurate, and addressed to a developer. Translate the ones an
        // administrator can act on; keep the code for the rest so a support
        // conversation still has something to search for.
        signInAccountErrorMessage(error) {
            const code = String(error?.code || '');
            if (code === 'auth/invalid-email') return 'That email address is not valid.';
            if (code === 'auth/weak-password') return 'The temporary password was refused as too weak. Try again to generate a new one.';
            if (code === 'auth/network-request-failed') return 'The sign-in account could not be created — check the connection and try again.';
            if (code === 'auth/too-many-requests') return 'Too many accounts were created in a short time. Wait a minute and try again.';
            return `The sign-in account could not be created${code ? ` (${code})` : ''}.`;
        },
        openUserAccessModal(usr = null) {
            if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
            if (usr) { this.userModal.isEdit = true; this.userModal.form = { uid: usr.uid || usr.id || '', name: usr.name || '', email: usr.email || '', password: '', role: usr.role || 'Staff' }; }
            else { this.userModal.isEdit = false; this.userModal.form = { uid: '', name: '', email: '', password: this.generateRandomPassword(), role: 'Staff' }; }
            this.userModal.show = true;
        },

        // One-click provisioning for a Client Portal Access account, called from the
        // New/Update Project modal for one of awaitingProjectClientEmails — an email
        // already saved on the client's Bill To record (Client Information form) that
        // has no login account yet. It opens the same Client access form using
        // exactly the email registered by staff in Client Information.
        openClientPortalAccessForEmail(email) {
            if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
            const customer = this.customers.find(item => item.id === this.projectModal.form.clientDirectoryId);
            this.userModal.isEdit = false;
            this.userModal.form = {
                uid: '',
                name: customer?.clientContactPerson || customer?.clientName || '',
                email: String(email || '').trim().toLowerCase(),
                password: this.generateRandomPassword(),
                role: 'Client',
            };
            this.userModal.show = true;
        },

        isLikelyFirebaseUid(value) {
            return typeof value === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(value);
        },
        // Fire-and-forget branded email notification for a workflow event (claim
        // submitted/decided, document shared, project stage changed, client
        // message). Never awaited by callers in a way that blocks the underlying
        // action — a failed notification should never stop the real work from
        // completing, so all errors are swallowed here.
        notifyByEmail({ to, subject, heading, message, ctaLabel, ctaUrl }) {
            const recipients = (Array.isArray(to) ? to : [to]).filter(e => typeof e === 'string' && e.includes('@'));
            if (!recipients.length || !auth.currentUser) return;
            auth.currentUser.getIdToken().then(idToken => fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ to: recipients, subject, heading, message, ctaLabel, ctaUrl: ctaUrl || PORTAL_URL })
            })).catch(error => console.warn('Notification email failed (non-fatal):', error));
        },
        emailsForRole(role) {
            return this.users.filter(u => u.role === role).map(u => u.email).filter(Boolean);
        },

        sendWelcomeEmail(userForm) {
            const originEmail = SUPPORT_EMAIL;
            const subject = encodeURIComponent(`[ZENQOR ENTERPRISE] Official Account & Portal Access Information (${this.getRoleDisplayName(userForm.role)})`);
                const emailBody = encodeURIComponent(`Greetings ${userForm.name},\n\nYour user account for the ZENQOR TECHNOLOGIES Enterprise Portal v2.0 has been created.\n\nSign-In Email: ${userForm.email}\nTemporary Password: ${userForm.password}\nAssigned Role: ${this.getRoleDisplayName(userForm.role)}\nPortal Link: ${PORTAL_URL}\n\nYou will be required to change this temporary password immediately after your first sign-in.\n\nBest regards,\nSystem Administrator`);
            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(userForm.email)}&su=${subject}&body=${emailBody}`, '_blank');
            this.showNotify(`Google Gmail compose window opened.`);
        },

        async savePortalUser() {
            try {
                if (!this.canManageRBAC) { this.showNotify('Only Superadmin and Director can manage portal access.'); return; }
                if (!this.userModal.form.name || !this.userModal.form.email || (this.userModal.isEdit === false && !this.userModal.form.password)) { this.showNotify("Please fill out all required fields."); return; }
                // Both directions, checked before the account exists rather than
                // discovered at the first sign-in attempt.
                if (!this.isPortalEmailAllowed(this.userModal.form.email, this.userModal.form.role)) {
                    this.showNotify(this.portalEmailRejectionMessage(this.userModal.form.role));
                    return;
                }

                this.userModal.form.name = this.toOfficialUppercase(this.userModal.form.name);
                const isNewUser = !this.userModal.isEdit;
                const email = this.userModal.form.email.trim().toLowerCase(); const password = this.userModal.form.password.trim();
                this.userModal.form.email = email;
                const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userModal.form.name)}&background=0B1E36&color=D4AF37`;
                const existingRecord = this.users.find(user => (user.email || '').toLowerCase() === email);
                // "Add New" (isNewUser) means the admin intends to create a DISTINCT
                // account. If existingRecord is already found, that email is not free —
                // it already resolves to a real users/{uid} doc (existingRecord.id is a
                // genuine Firebase UID). Without this guard, the code below would still
                // treat existingRecord's id as "the" userId (see possibleUid) and, once
                // createUserWithEmailAndPassword predictably fails with
                // auth/email-already-in-use, fall straight into `setDoc(doc(db, "users",
                // userId), { role: this.userModal.form.role, name: ..., ... })` —
                // silently overwriting that OTHER, real account's role/name/photo with
                // whatever was just typed for this "new" one (and flipping the caller's
                // own session role live if they happened to reuse their own email). Block
                // it here instead: this is almost always a Director/Superadmin trying to
                // grant Client Portal access using a @zenq0r.com email that already
                // belongs to an existing staff account under a different role.
                if (isNewUser && existingRecord) {
                    this.showNotify(`Unable to create a new account: ${email} already belongs to an existing ${existingRecord.role || 'portal'} account (${existingRecord.name || email}). Edit that existing record instead of adding a new one, or use a different email.`);
                    return;
                }
                const possibleUid = this.userModal.form.uid || existingRecord?.uid || existingRecord?.id || '';
                let userId = this.isLikelyFirebaseUid(possibleUid) ? possibleUid : '';
                let existingAuthenticationAccount = false;

                if (isNewUser) {
                    const secondaryApp = initializeApp(auth.app.options, "SecondaryAuthApp-" + Date.now());
                    const secondaryAuth = getAuth(secondaryApp);
                    try {
                        const createdUser = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                        userId = createdUser.user.uid;
                    } catch (authErr) {
                        if (authErr.code === 'auth/email-already-in-use') existingAuthenticationAccount = true;
                        else { console.error('Creating the sign-in account failed:', authErr); this.showNotify(this.signInAccountErrorMessage(authErr), 'error'); return; }
                    } finally {
                        await signOut(secondaryAuth).catch(() => {});
                        await deleteApp(secondaryApp).catch(() => {});
                    }
                }

                if (!userId) {
                    await setDoc(doc(db, 'pending_access', email), {
                        email,
                        name: this.userModal.form.name,
                        photo: photoUrl,
                        role: this.userModal.form.role,
                        mustChangePassword: false,
                        createdByUid: this.userProfile.uid,
                        createdAt: new Date().toISOString()
                    }, { merge: true });
                    this.userModal.show = false;
                    this.logAudit('CREATE', `Pending UID migration created for ${email}`);
                    // If a users/{uid} doc already exists for this email (existingRecord,
                    // computed above), this pending_access entry will NEVER be consumed:
                    // loadOrMigrateUserMetadata() returns that existing doc immediately on
                    // every future login and never reaches the pending_access migration
                    // path. That's the normal case here — this branch runs precisely
                    // because Firebase Auth already has an account for this email
                    // (auth/email-already-in-use), and almost always that's an existing
                    // staff account (role !== 'Client') on the @zenq0r.com domain. Telling
                    // the admin "access will activate automatically" would be false in
                    // that case, so say so plainly instead of leaving them to discover it
                    // only when a Project's Client Portal Access link stays unresolved.
                    if (existingRecord) {
                        this.showNotify(`Unable to grant Client Portal access: ${email} already belongs to an active ${existingRecord.role || 'staff'} account. One email can only be one portal account — use a different email for this Client.`);
                    } else {
                        this.showNotify(existingAuthenticationAccount ? 'This email already has a sign-in account. Portal access will switch on the next time it signs in.' : 'Portal access will switch on the first time this person signs in.');
                    }
                    return;
                }
                await setDoc(doc(db, "users", userId), { email: email, name: this.userModal.form.name, photo: photoUrl, role: this.userModal.form.role, ...(isNewUser ? { mustChangePassword: true } : {}) }, { merge: true });
                if (userId === this.userProfile.uid) {
                    this.userProfile.role = this.userModal.form.role;
                    this.userProfile.name = this.userModal.form.name;
                    this.userProfile.photo = photoUrl;
                }
                this.userModal.show = false;
                this.logAudit(isNewUser ? 'CREATE' : 'UPDATE', `User role/metadata for ${email}`);
                this.syncUserClaims(userId).catch(() => {});
                if (isNewUser) { this.sendWelcomeEmail(this.userModal.form); this.showNotify('Portal account created.'); }
                else this.showNotify('User updated successfully!');
            } catch (error) {
                console.error('Portal access save failed:', error);
                this.showNotify('Unable to save portal access. Try again, and tell the portal administrator if it keeps failing.', 'error');
            }
        },

        async deletePortalUser(uid, email) {
            if (!await this.askConfirm({
                title: 'Delete portal access?',
                message: `This permanently removes portal access and the sign-in account for ${email}.`,
                confirmLabel: 'Yes, Delete Access',
                danger: true
            })) return;
            try {
                // Delete the Firebase Authentication account FIRST (via Admin SDK — the
                // client SDK can only ever delete the currently signed-in user's own
                // account) so access is revoked even if the Firestore cleanup below
                // fails for some reason; a retry then just cleans up the leftover
                // Firestore doc (the endpoint treats an already-deleted Auth account as
                // success, not an error). Without this step, the Auth account
                // (Identifier/Providers/Created/Signed In/User UID in the Firebase
                // Console) would otherwise linger indefinitely after "deleting" someone
                // here, since deleteDoc alone only ever removed the Firestore record.
                if (auth.currentUser) {
                    const idToken = await auth.currentUser.getIdToken();
                    const resp = await fetch('/api/portal-account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify({ action: 'delete', uid })
                    });
                    if (!resp.ok) {
                        const errBody = await resp.json().catch(() => ({}));
                        throw new Error(errBody.error || 'Unable to delete the sign-in account.');
                    }
                }
                await deleteDoc(doc(db, "users", uid));
                this.logAudit('DELETE', `Deleted user metadata for ${email}`);
                this.showNotify('Portal access and sign-in account deleted.');
            } catch (error) {
                console.error('Portal user deletion failed:', error);
                // Stated rather than inferred: the server's wording varies with
                // the cause, and two of its messages read as neutral prose.
                this.showNotify(error?.message || 'Unable to delete portal access.', 'error');
            }
        },

        // ============================================================
        // STAFF PORTAL - interaction buttons on a portal account
        // View / Read / Access are read-only and open the same drawer on a
        // different tab. Edit / Lock / Reset / Delete write, and every one of
        // them re-checks canManageStaffPortal here rather than trusting that
        // the button was hidden - the right-click menu, a stale render and the
        // console all reach these methods too. firestore.rules checks again.
        // ============================================================
        isAccountLocked(user) {
            return user?.accessLocked === true;
        },
        staffPortalStatusBadge(usr) {
            if (this.isAccountLocked(usr)) return { label: 'Locked', className: 'zq-badge-error', icon: 'fa-lock' };
            if (usr?.mustChangePassword === true) return { label: 'Password Reset Pending', className: 'zq-badge-warning', icon: 'fa-key' };
            if (this.isPortalUserOnline(usr)) return { label: 'Active - Online', className: 'zq-badge-success', icon: 'fa-circle' };
            return { label: 'Active', className: 'zq-badge-neutral', icon: 'fa-circle-check' };
        },
        // The seed administrator is the non-deletable bootstrap account: locking,
        // resetting or deleting it is how an organisation locks itself out of its
        // own portal, so none of the writing actions are offered on it. Lock and
        // Delete are additionally withheld on the viewer's own row, for the same
        // reason at the individual level.
        isStaffPortalActionAvailable(actionKey, usr) {
            const action = STAFF_PORTAL_ACTIONS.find(item => item.key === actionKey);
            if (!action) return false;
            if (!action.write) return this.canObserveStaffPortal;
            if (!this.canManageStaffPortal) return false;
            if (this.isSeedAdminEmail(usr?.email)) return false;
            if (['lock', 'delete'].includes(actionKey) && usr?.id === this.userProfile.uid) return false;
            return true;
        },
        // The row's buttons, in the fixed order of STAFF_PORTAL_ACTIONS, already
        // filtered to what this viewer may press on this account. Lock is the one
        // entry whose label depends on the row: it reads Unlock once locked.
        staffPortalActionsFor(usr) {
            return STAFF_PORTAL_ACTIONS
                .filter(action => this.isStaffPortalActionAvailable(action.key, usr))
                .map(action => {
                    if (action.key !== 'lock' || !this.isAccountLocked(usr)) return { ...action };
                    return { ...action, label: 'Unlock', icon: 'fa-lock-open', variant: 'zq-btn-success', title: 'Restore portal access for this account' };
                });
        },
        runStaffPortalAction(actionKey, usr) {
            if (!this.isStaffPortalActionAvailable(actionKey, usr)) { this.showNotify('You do not have permission for that Staff Portal action.'); return; }
            const handlers = {
                view: () => this.openStaffPortalAccount(usr, 'overview'),
                read: () => this.openStaffPortalAccount(usr, 'activity'),
                access: () => this.openStaffPortalAccount(usr, 'access'),
                edit: () => this.openUserAccessModal(usr),
                lock: () => this.toggleStaffPortalLock(usr),
                reset: () => this.requireStaffPortalPasswordChange(usr),
                delete: () => this.deletePortalUser(usr.id, usr.email)
            };
            (handlers[actionKey] || (() => {}))();
        },
        openStaffPortalAccount(usr, tab = 'overview') {
            if (!this.canObserveStaffPortal) { this.showNotify('You do not have permission to open the Staff Portal.'); return; }
            this.staffPortalAccount = { show: true, tab, account: usr ? { ...usr } : null };
        },
        closeStaffPortalAccount() {
            this.staffPortalAccount = { show: false, tab: 'overview', account: null };
        },
        // What the role on this account unlocks: one row per module the role
        // opens, out of RBAC_ROLES. Edit and Delete come from
        // MODULE_ACTIONS, which knows the difference between an action the role
        // is refused and an action the module does not have — a Delete tick on
        // the Audit Log described something nobody can do.
        staffPortalAccessMatrix(role) {
            const modules = RBAC_ROLES[role] || [];
            return modules.map(moduleName => ({
                module: moduleName,
                label: MODULE_LABELS[moduleName] || moduleName,
                edit: moduleActionFor(moduleName, 'edit', role),
                remove: moduleActionFor(moduleName, 'remove', role),
                note: MODULE_ACTIONS[moduleName]?.note || ''
            }));
        },
        // The Read tab: this account's own trail out of the audit log that
        // Superadmin/Director/IT already subscribe to. auditLogs arrives sorted
        // newest-first, and the result is capped so a long-serving account does
        // not render thousands of rows into a drawer. Matched on uid where the
        // entry carries one and on the signed-in email otherwise, so events
        // recorded before a UID migration are not silently dropped.
        staffPortalAccountActivity(account) {
            const uid = String(account?.id || '').trim();
            const email = String(account?.email || '').trim().toLowerCase();
            if (!uid && !email) return [];
            return this.auditLogs
                .filter(log => (uid && log.uid === uid) || (email && String(log.user || '').trim().toLowerCase() === email))
                .slice(0, 100);
        },
        async toggleStaffPortalLock(usr) {
            if (!this.isStaffPortalActionAvailable('lock', usr)) { this.showNotify('Only Superadmin and Director can lock a portal account.'); return; }
            const locking = !this.isAccountLocked(usr);
            const answer = await this.askConfirmWithNote({
                title: locking ? 'Lock this portal account?' : 'Unlock this portal account?',
                message: locking
                    ? `${usr.email} keeps their record and role but cannot sign in, and their open session ends. Unlock restores access at any time.`
                    : `${usr.email} will be able to sign in again immediately.`,
                confirmLabel: locking ? 'Yes, Lock Access' : 'Yes, Unlock Access',
                danger: locking,
                noteLabel: locking ? 'Reason recorded on the account' : '',
                notePlaceholder: locking ? 'e.g. On extended leave, pending investigation' : ''
            });
            if (!answer.confirmed) return;
            this.staffPortalBusyUid = usr.id;
            try {
                // Routed through the Admin SDK rather than written from here. A
                // lock has to reach Storage as well, and storage.rules reads the
                // role from the ID token's custom claims, which only the server
                // can clear — a Firestore write alone would close the portal and
                // leave client_documents open. The endpoint also stamps who
                // locked the account from its verified token, so that field
                // cannot be forged. See api/portal-account.js.
                if (!auth.currentUser) throw new Error('Your session has ended. Sign in again, then retry.');
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/portal-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ action: locking ? 'lock' : 'unlock', uid: usr.id, reason: answer.note })
                });
                if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || 'Unable to change this account’s portal access.');
                }
                this.logAudit(locking ? 'LOCK' : 'UNLOCK', `${locking ? 'Locked' : 'Unlocked'} portal access for ${usr.email}${locking && answer.note ? ` - ${answer.note}` : ''}`);
                this.showNotify(locking ? 'Portal access locked.' : 'Portal access unlocked.');
                this.notifyByEmail({
                    to: usr.email,
                    subject: `[ZENQOR ENTERPRISE] Portal access ${locking ? 'locked' : 'restored'}`,
                    heading: locking ? 'Portal access locked' : 'Portal access restored',
                    message: locking
                        ? 'Your ZENQOR portal access has been locked by an administrator. Please contact your administrator for details.'
                        : 'Your ZENQOR portal access has been restored. You may sign in again.'
                });
            } catch (error) {
                console.error('Staff Portal lock change failed:', error);
                // Stated rather than inferred: the endpoint's wording varies with
                // the cause, and it is the only thing that knows how far the
                // change got across Firestore, Storage claims and Authentication.
                this.showNotify(error?.message || 'Unable to change this account’s portal access.', 'error');
            } finally {
                this.staffPortalBusyUid = '';
            }
        },
        // "Reset" here is the portal-side half only: it flags the account so the
        // next sign-in is forced through the change-password flow. Nothing in
        // this portal can read or set anybody else's password.
        async requireStaffPortalPasswordChange(usr) {
            if (!this.isStaffPortalActionAvailable('reset', usr)) { this.showNotify('Only Superadmin and Director can require a password reset.'); return; }
            if (usr.mustChangePassword === true) { this.showNotify('This account is already required to change its password at the next sign-in.'); return; }
            if (!await this.askConfirm({
                title: 'Require a new password?',
                message: `${usr.email} will be asked to set a new password the next time they sign in. Their current password keeps working until then.`,
                confirmLabel: 'Yes, Require Reset'
            })) return;
            this.staffPortalBusyUid = usr.id;
            try {
                await setDoc(doc(db, 'users', usr.id), { mustChangePassword: true }, { merge: true });
                this.logAudit('UPDATE', `Required a password change at next sign-in for ${usr.email}`);
                this.showNotify('The account will be asked for a new password at its next sign-in.');
                this.notifyByEmail({
                    to: usr.email,
                    subject: '[ZENQOR ENTERPRISE] Password change required',
                    heading: 'Password change required',
                    message: 'Your administrator has asked you to set a new ZENQOR portal password. You will be prompted for one the next time you sign in.'
                });
            } catch (error) {
                console.error('Password reset requirement failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, 'require a password reset'));
            } finally {
                this.staffPortalBusyUid = '';
            }
        },

        // ============================================================
        // STAFF PORTAL - access requests (Accept / Reject)
        // A staff member asks from their own Profile page for a different role;
        // Superadmin/Director decide it in the Staff Portal. Accepting applies
        // the role to users/{uid} and re-syncs the Auth custom claims, exactly
        // what the Edit form does - so an accepted request and a manual role
        // change leave the account in the same state.
        // ============================================================
        openAccessRequestModal() {
            if (!this.canRequestAccessChange) { this.showNotify('Your account cannot raise a portal access request.'); return; }
            if (this.myPendingAccessRequest) { this.showNotify('You already have a request awaiting a decision.'); return; }
            this.accessRequestModal = { show: true, saving: false, requestedRole: this.requestableRoles[0] || '', reason: '', error: '' };
        },
        async submitAccessRequest() {
            if (!this.canRequestAccessChange) { this.showNotify('Your account cannot raise a portal access request.'); return; }
            if (this.myPendingAccessRequest) { this.accessRequestModal.error = 'You already have a request awaiting a decision.'; return; }
            const requestedRole = this.accessRequestModal.requestedRole;
            const reason = String(this.accessRequestModal.reason || '').trim();
            if (!this.requestableRoles.includes(requestedRole)) { this.accessRequestModal.error = 'Choose a role to request.'; return; }
            if (reason.length < 10) { this.accessRequestModal.error = 'Please give the reviewer at least a short reason (10 characters).'; return; }
            this.accessRequestModal.saving = true;
            this.accessRequestModal.error = '';
            try {
                const requestRef = doc(collection(db, 'access_requests'));
                await setDoc(requestRef, {
                    requesterUid: this.userProfile.uid,
                    requesterEmail: String(this.userProfile.email || '').trim().toLowerCase(),
                    requesterName: this.userProfile.name || '',
                    currentRole: this.userProfile.role,
                    requestedRole,
                    reason,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                });
                this.logAudit('CREATE', `Requested a portal access change to ${requestedRole}`);
                this.accessRequestModal = { show: false, saving: false, requestedRole: '', reason: '', error: '' };
                this.showNotify('Your access request has been sent for a decision.');
                this.notifyByEmail({
                    to: [...this.emailsForRole('Superadmin'), ...this.emailsForRole('Director')],
                    subject: '[ZENQOR ENTERPRISE] New portal access request',
                    heading: 'A portal access request is waiting',
                    message: `${this.userProfile.name || this.userProfile.email} asked to move from ${this.getRoleDisplayName(this.userProfile.role)} to ${this.getRoleDisplayName(requestedRole)}.`,
                    ctaLabel: 'Open the Staff Portal'
                });
            } catch (error) {
                console.error('Access request failed:', error);
                this.accessRequestModal.error = this.getFirestoreWriteError(error, 'send this access request');
            } finally {
                this.accessRequestModal.saving = false;
            }
        },
        accessRequestStatusBadge(request) {
            const status = request?.status || 'Pending';
            if (status === 'Accepted') return { label: 'Accepted', className: 'zq-badge-success', icon: 'fa-circle-check' };
            if (status === 'Rejected') return { label: 'Rejected', className: 'zq-badge-error', icon: 'fa-circle-xmark' };
            return { label: 'Pending', className: 'zq-badge-warning', icon: 'fa-hourglass-half' };
        },
        staffPortalRequestActions() {
            return this.canManageStaffPortal ? STAFF_PORTAL_REQUEST_ACTIONS.map(action => ({ ...action })) : [];
        },
        runAccessRequestAction(actionKey, request) {
            if (actionKey === 'accept') return this.decideAccessRequest(request, 'Accepted');
            if (actionKey === 'reject') return this.decideAccessRequest(request, 'Rejected');
        },
        async decideAccessRequest(request, decision) {
            if (!this.canManageStaffPortal) { this.showNotify('Only Superadmin and Director can decide an access request.'); return; }
            if (!request?.id || (request.status || 'Pending') !== 'Pending') { this.showNotify('This request has already been decided.'); return; }
            const accepting = decision === 'Accepted';
            // Accepting writes the requester's role. Refuse rather than guess if
            // the target account has since left the portal directory.
            const target = this.users.find(user => user.id === request.requesterUid);
            if (accepting && !target) { this.showNotify('The requesting account no longer exists in the portal directory.'); return; }
            if (accepting && !this.isPortalEmailAllowed(request.requesterEmail, request.requestedRole)) {
                this.showNotify(`Staff and Management access requires ${this.approvedStaffDomainsLabel()}.`);
                return;
            }
            const answer = await this.askConfirmWithNote({
                title: accepting ? 'Accept this access request?' : 'Reject this access request?',
                message: accepting
                    ? `${request.requesterEmail} becomes ${this.getRoleDisplayName(request.requestedRole)} immediately, replacing ${this.getRoleDisplayName(request.currentRole)}.`
                    : `${request.requesterEmail} keeps ${this.getRoleDisplayName(request.currentRole)} and is told the request was declined.`,
                confirmLabel: accepting ? 'Yes, Accept Request' : 'Yes, Reject Request',
                danger: !accepting,
                noteLabel: 'Decision note (optional)',
                notePlaceholder: accepting ? 'e.g. Approved for the new finance duties' : 'e.g. Raise this again after the handover'
            });
            if (!answer.confirmed) return;
            this.staffPortalBusyUid = request.id;
            try {
                if (accepting) {
                    await setDoc(doc(db, 'users', request.requesterUid), { role: request.requestedRole }, { merge: true });
                    // The same follow-up the Edit form does: Storage Rules read the
                    // role from the Auth custom claims, which do not move on their own.
                    await this.syncUserClaims(request.requesterUid);
                }
                await setDoc(doc(db, 'access_requests', request.id), {
                    status: decision,
                    decidedBy: String(this.userProfile.email || '').trim().toLowerCase(),
                    decidedAt: new Date().toISOString(),
                    decisionNote: answer.note
                }, { merge: true });
                this.logAudit('UPDATE', `${decision} the portal access request from ${request.requesterEmail} for ${request.requestedRole}`);
                this.showNotify(accepting ? 'Access request accepted and the role applied.' : 'Access request rejected.');
                this.notifyByEmail({
                    to: request.requesterEmail,
                    subject: `[ZENQOR ENTERPRISE] Your access request was ${decision.toLowerCase()}`,
                    heading: accepting ? 'Access request accepted' : 'Access request rejected',
                    message: accepting
                        ? `Your portal role is now ${this.getRoleDisplayName(request.requestedRole)}. Sign out and back in to pick it up.`
                        : `Your request to move to ${this.getRoleDisplayName(request.requestedRole)} was declined.${answer.note ? ` Note: ${answer.note}` : ''}`
                });
            } catch (error) {
                console.error('Access request decision failed:', error);
                this.showNotify(this.getFirestoreWriteError(error, accepting ? 'accept this request' : 'reject this request'));
            } finally {
                this.staffPortalBusyUid = '';
            }
        },

        backupDatabase() {
            if (!this.canBackupDatabase) { this.showNotify('Only Superadmin and Director can export a database backup.'); return; }
            const data = { company: this.company, employees: this.employees, customers: this.customers, docHistory: this.docHistory, payslipHistory: this.payslipHistory, claimsHistory: this.claimsHistory, paymentVouchers: this.paymentVouchers, projects: this.projects, projectActivities: this.projectActivities, projectClientUpdates: this.projectClientUpdates, users: this.users.map(u => ({ name: u.name, email: u.email, role: u.role })), exportDate: new Date().toISOString() };
            const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dlAnchorElem = document.createElement('a'); dlAnchorElem.setAttribute("href", jsonStr); dlAnchorElem.setAttribute("download", `zenqor_backup_${new Date().toISOString().substr(0,10)}.json`); dlAnchorElem.click();
            this.logAudit('BACKUP', 'Exported JSON backup'); this.showNotify("Database JSON backup downloaded!");
        },

        async saveSettings() {
            if (!this.canManageCompanySettings) { this.showNotify('You do not have permission to update company settings.'); return; }
            try { this.company.address = this.formattedCompanyAddress(); this.company = this.normalizeOfficialRecord(this.company); this.company.email = String(this.company.email || '').trim().toLowerCase(); await setDoc(doc(db, "settings", "company_profile"), { ...this.company }, { merge: true }); this.logAudit('UPDATE', 'Updated settings'); this.showNotify('Settings updated!'); } catch (error) { this.showNotify('Unable to save company settings.', 'error'); }
        }
};