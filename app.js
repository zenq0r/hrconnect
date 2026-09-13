// ============================================================
// ZENQOR TECHNOLOGIES - app.js (ENTERPRISE FINAL BUILD v8.7)
//
// Entry point only. This file and what it imports are the sign-in page: the
// signed-in portal's code (app/portal.js) and its markup (views/) are both
// fetched after a session is confirmed, so a visitor who never signs in
// downloads neither.
// ============================================================

import {
    auth,
    signOut,
    onAuthStateChanged
} from "./firebase-config.js";

// Vercel Web Analytics
import { inject } from "https://unpkg.com/@vercel/analytics@2.0.1/dist/index.mjs";
import { longpressDirective } from "./app/directives/longpress.js";
import { ZqView, homeTabFor } from "./app/views.js";
import { createInitialState } from "./app/state.js";
import { accessComputed } from "./app/computed/access.js";
import { directoryComputed } from "./app/computed/directory.js";
import { clientPortalComputed } from "./app/computed/client-portal.js";
import { billingComputed } from "./app/computed/billing.js";
import { reportsComputed } from "./app/computed/reports.js";
import { tablesComputed } from "./app/computed/tables.js";
import { projectsComputed } from "./app/computed/projects.js";
import { accessMethods } from "./app/methods/access.js";
import { presenceMethods } from "./app/methods/presence.js";
import { notificationMethods } from "./app/methods/notifications.js";
import { shellMethods } from "./app/methods/shell.js";
import { dashboardMethods } from "./app/methods/dashboard.js";
import { auditMethods } from "./app/methods/audit.js";
import { authMethods } from "./app/methods/auth.js";
import { formMethods } from "./app/methods/forms.js";
import { displayMethods } from "./app/methods/display.js";

inject();

const { createApp } = Vue;

createApp({
    data() {
        return createInitialState();
    },
    // Every view rendered out of views/ runs in this component's scope, so the
    // markup in those files reads the same state and calls the same methods it
    // did when it all lived in index.html. See app/views.js.
    provide() {
        return { zqPortalHost: this };
    },
    computed: {
        ...accessComputed,
        ...directoryComputed,
        ...clientPortalComputed,
        ...billingComputed,
        ...reportsComputed,
        ...tablesComputed,
        ...projectsComputed
    },
    watch: {
        currentTab(nextTab, previousTab) {
            // A screen's markup is fetched the first time it is opened, from
            // wherever the route change came from — sidebar, Back button or a
            // method that switches tab on its own.
            this.ensureTabView(nextTab);
            if (previousTab === 'dashboard' && nextTab !== 'dashboard') this.destroyDashboardCharts();
            if (nextTab === 'dashboard' && previousTab !== 'dashboard') this.refreshDashboardCharts();
            if (nextTab === 'audit-logs' && previousTab !== 'audit-logs') this.loadAuditRetention();
        },
        recentActivityFilter() { this.currentPage = 1; },
        recentActivityAttentionOnly() { this.currentPage = 1; },
        sortOption() { this.currentPage = 1; },
        searchQuery() { this.currentPage = 1; },
        // Global scroll lock: locks the page behind whatever overlay is open, and
        // restores exactly whatever inline style was there before (usually '',
        // but this avoids clobbering anything unexpected) once every overlay in
        // anyOverlayOpen has closed.
        anyOverlayOpen(isOpen) {
            if (isOpen) {
                if (this._scrollLockPrevOverflow === undefined) this._scrollLockPrevOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
            } else if (this._scrollLockPrevOverflow !== undefined) {
                document.body.style.overflow = this._scrollLockPrevOverflow;
                this._scrollLockPrevOverflow = undefined;
            }
        }
    },
    // Only what the sign-in page and a sign-in need. Everything a signed-in
    // screen does is in app/portal.js, fetched and bound onto this component
    // by ensurePortalCode() — see app/methods/shell.js. Spread rather than
    // nested, so `this.<method>()` resolves the same way for both.
    methods: {
        ...accessMethods,
        ...presenceMethods,
        ...notificationMethods,
        ...shellMethods,
        ...dashboardMethods,
        ...auditMethods,
        ...authMethods,
        ...formMethods,
        ...displayMethods
    },
    mounted() {
        this.checkPasswordResetLink();
        // The payslip and document forms, and the right-click menu on portal
        // buttons, are prepared by startPortal() in app/portal.js once that code
        // has been fetched — not here, for every visitor to the sign-in page.
        window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
        this.browserBackHandler = (event) => {
            if (this.isLoggedIn) this.restoreTabFromHistory(event.state?.tab);
        };
        window.addEventListener('popstate', this.browserBackHandler);

        // Escape-to-close (Step 24) — deferred in Step 11's modal architecture pass.
        // Mirrors each overlay's own @click.self backdrop-dismiss behavior exactly:
        // a modal only closes on Escape if it already closes on a backdrop click.
        // Modals with no @click.self (idle-timeout warning, the employee/portal-
        // access/change-password forms, the pre-login OTP challenge) are deliberately
        // NOT closable this way, same as they're not backdrop-closable — Escape must
        // not make a mandatory or data-entry-sensitive dialog accidentally dismissible.
        // Checked topmost (highest z-index) first, in case more than one is ever open.
        this.globalEscapeHandler = (event) => {
            if (event.key !== 'Escape') return;
            if (this.markProjectDoneModal.show && this.markProjectDoneModal.project) { this.closeMarkProjectDoneModal(); return; }
            if (this.appConfirm.show) { this.resolveAppConfirm(false); return; }
            if (this.employeeView.show) { this.employeeView.show = false; return; }
            if (this.staffPortalAccount.show) { this.closeStaffPortalAccount(); return; }
            if (this.clientView.show) { this.closeClientView(); return; }
            if (this.clientUpdateModal.show && this.clientUpdateModal.project) { this.closeClientUpdateModal(); return; }
            if (this.websiteContentModal.show) { this.closeWebsiteContentModal(); return; }
            if (this.siteTextModal.show) { this.closeSiteTextModal(); return; }
            if (this.activityModal.show && this.activityModal.project) { this.closeActivityModal(); return; }
            if (this.projectPreview.show && this.projectPreview.project) { this.closeProjectDetails(); return; }
            if (this.projectModal.show) { this.closeProjectModal(); return; }
            if (this.logoutConfirm) { this.logoutConfirm = false; return; }
            if (this.postLogoutChoice) { this.stayOnPortal(); return; }
            if (this.clientActionConfirm.show) { this.clientActionConfirm.show = false; return; }
            if (this.employeeActionConfirm.show) { this.employeeActionConfirm.show = false; return; }
            if (this.contextMenu.show) { this.closeContextMenu(); return; }
            if (this.clientTaskModal.show) { this.closeClientTaskModal(); return; }
        };
        window.addEventListener('keydown', this.globalEscapeHandler);

        this.checkForAppUpdate();
        this.appUpdateCheckInterval = setInterval(() => this.checkForAppUpdate(), 5 * 60 * 1000);
        this.appVisibilityHandler = () => { if (document.visibilityState === 'visible') this.checkForAppUpdate(); };
        document.addEventListener('visibilitychange', this.appVisibilityHandler);

        onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Session restoration can race with a cached layout. Keep the
                // navigation closed until the restored session is ready.
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                if (this.interactiveLoginInProgress) { this.authLoading = false; return; }
                if (this.isLoggedIn && this.userProfile.uid === firebaseUser.uid) { this.authLoading = false; return; }
                // A sign-in that stopped at the verification code leaves a real
                // Firebase session behind, and a session is restorable. Without
                // this, reloading the page — or opening a second tab — would
                // walk straight past the code that was never answered.
                if (this.pendingSecondFactorUid() === firebaseUser.uid) {
                    this.setPendingSecondFactor('');
                    // Not marked intentional: that would have the signed-out branch
                    // below clear this message before anyone could read it.
                    this.loginError = 'Sign-in was not completed. Sign in again and enter the verification code sent to your email.';
                    this.authLoading = false;
                    await signOut(auth).catch(error => console.error('Sign-out of an unverified session failed:', error));
                    return;
                }
                try {
                    this.loginLoading = true;
                    // A restored session on a slow/flaky connection (mobile data, a cold
                    // Firestore connection right after a hard refresh) can otherwise leave
                    // this getDoc() waiting indefinitely for a server round-trip — which
                    // reads as the whole portal being stuck on the landing screen with no
                    // spinner, no error, nothing. Bound it so that failure mode surfaces as
                    // a real, actionable error instead (see the catch block below).
                    const userData = await Promise.race([
                        this.loadOrMigrateUserMetadata(firebaseUser),
                        this.timeoutPromise(15000, 'Timed out while loading your account. Please check your connection and sign in again.')
                    ]);
                    const isSeedAdmin = this.isSeedAdminEmail(firebaseUser.email);

                    if (!userData && !isSeedAdmin) {
                        this.loginError = 'This account is not provisioned or your access has been revoked. Contact your administrator.';
                        await signOut(auth);
                        return;
                    }

                    const lockedMessage = this.accountLockedSignInMessage(userData, firebaseUser.email);
                    if (lockedMessage) {
                        this.loginError = lockedMessage;
                        await signOut(auth);
                        return;
                    }

                    let role = userData?.role || 'Staff';
                    let name = userData?.name || firebaseUser.displayName || firebaseUser.email;
                    let photo = userData?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B1E36&color=D4AF37`;
                    const mustChangePassword = userData?.mustChangePassword === true;
                    if (isSeedAdmin) role = 'Superadmin';
                    if (!this.isPortalEmailAllowed(firebaseUser.email, role)) {
                        this.loginError = this.portalEmailRejectionMessage(role);
                        await signOut(auth);
                        return;
                    }
                    const loginContext = { firebaseUser, userData, role, name, photo, mustChangePassword };
                    if (mustChangePassword) {
                        this.loginLoading = false;
                        this.authLoading = false;
                        this.openFirstTimePasswordFlow(loginContext);
                        return;
                    }
                    this.userProfile = { name, email: firebaseUser.email, role, uid: firebaseUser.uid, photo, mustChangePassword, themePreference: userData?.themePreference || 'light' };
                    this.applyDarkModePreference();
                    this.notificationsLog = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : [];
                    this.startIdleTimeoutWatch();
                    // Same as an interactive sign-in: the portal's code and
                    // markup are fetched before the portal is shown — and before
                    // resetAllForms(), which calls into that code.
                    await Promise.all([this.syncUserClaims(), this.ensurePortalViews(role)]);
                    this.resetAllForms();
                    this.isLoggedIn = true;
                    // The sidebar stays closed after a restored session too;
                    // it only opens when the user presses the menu control.
                    this.desktopSidebarOpen = false;
                    this.mobileMenuOpen = false;
                    this.currentTab = homeTabFor(role);
                    this.playWelcomeGreeting();
                    window.history.replaceState({ zenqorPortal: true, tab: this.currentTab }, '', window.location.href);
                    this.loginLoading = false;
                    this.initFirebaseRealtime().catch(error => {
                        console.error('Realtime data initialization failed after login:', error);
                        this.portalDataReady = false;
                    });
                    this.startClientStatusClock();
                    this.startPresenceTracking().catch(error => console.error('Presence tracking failed after login:', error));
                    this.refreshDashboardCharts();
                } catch (e) {
                    console.error("Error fetching user metadata:", e);
                    this.isLoggedIn = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false;
                    this.loginLoading = false;
                    // Surface this instead of silently dropping back to the role-chooser
                    // landing screen with no explanation — that's what read as a "hang" to
                    // begin with. Sign out too: Firebase still considers this session valid,
                    // so without it every subsequent refresh would hit this same error again.
                    this.loginError = 'We could not restore your session. Please sign in again.';
                    try { await signOut(auth); } catch (signOutError) { console.error('Sign-out after failed session restore also failed:', signOutError); }
                }
            } else {
                // Preserve a revocation/restore error, but never carry one onto
                // the landing screen after the user chose to sign out normally.
                if (this.intentionalLogoutInProgress) this.loginError = '';
                this.intentionalLogoutInProgress = false;
                this.stopPresenceTracking();
                this.stopClientStatusClock();
                this.isLoggedIn = false; this.mobileMenuOpen = false; this.desktopSidebarOpen = false;
                this.loginLoading = false;
                this.destroyDashboardCharts();
                this.portalDataReady = false;
                this.portalDataReadyPromise = null;
                this.userProfile = { name: '', email: '', role: '', photo: '' };
                // Screens are remounted on the next sign-in, for whichever
                // role that turns out to be.
                this.mountedViews = [];
                this.viewError = '';
                this.unsubscribers.forEach(unsub => unsub && unsub());
                this.unsubscribers = [];
                if (this.clientDocumentsUnsubscribe) { this.clientDocumentsUnsubscribe(); this.clientDocumentsUnsubscribe = null; }
                this.clientDocuments = { clientDirectoryId: '', clientName: '', clientEmail: '', items: [], loading: false, uploading: false, error: '' };
                this.projects = [];
                this.projectActivities = [];
                this.projectClientUpdates = [];
                this.projectActivitiesLoaded = false;
                this.projectClientUpdatesLoaded = false;
                this.employees = [];
                this.customers = [];
                this.docHistory = [];
                this.payslipHistory = [];
                this.claimsHistory = [];
                this.paymentVouchers = [];
                this.users = [];
                this.auditLogs = [];
                this.accessRequests = [];
                this.staffPortalAccount = { show: false, tab: 'overview', account: null };
                this.staffPortalBusyUid = '';
                this.websiteContent = { portfolio_web: [], portfolio_gaming: [], services: [] };
                this.siteTextOverrides = {};
                this.notificationsLog = [];
                this.portalNotifications = [];
                this.portalNotificationsLoaded = false;
                this.notificationsPanelOpen = false;
                if (this.notificationsSyncTimer) { clearTimeout(this.notificationsSyncTimer); this.notificationsSyncTimer = null; }
                this.stopIdleTimeoutWatch();
            }
            this.authLoading = false;
        });
    },
    unmounted() {
        if (this.isLoggedIn) this.setCurrentEmployeePresence(false);
        this.stopPresenceTracking();
        this.stopClientStatusClock();
        this.unsubscribers.forEach(unsub => unsub && unsub());
        if (this.clientDocumentsUnsubscribe) this.clientDocumentsUnsubscribe();
        if (this.browserBackHandler) window.removeEventListener('popstate', this.browserBackHandler);
        if (this.appUpdateCheckInterval) clearInterval(this.appUpdateCheckInterval);
        if (this.appVisibilityHandler) document.removeEventListener('visibilitychange', this.appVisibilityHandler);
        if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
        this.clearWelcomeGreetingTimers();
        if (this.portalCodeLoaded) this.removeUniversalButtonContextMenu();
        this.stopIdleTimeoutWatch();
    }
}).component('zq-view', ZqView).directive('longpress', longpressDirective).mount('#app');
