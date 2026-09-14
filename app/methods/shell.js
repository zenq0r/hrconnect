// Portal chrome: sidebar, dark mode, tab routing, idle sign-out, the welcome
// greeting and the new-version check.
import {
    db,
    doc,
    setDoc
} from "../../firebase-config.js";
import { WELCOME_GREETING_HOLD_MS, WELCOME_GREETING_FADE_MS, SIDEBAR_GROUPS_STORAGE_KEY } from "../config.js";
import { CLIENT_PANELS, CLIENT_LEGACY_TABS } from "../constants/client-tiers.js";
import { ALWAYS_LOADED_VIEWS, loadView, viewForTab, homeTabFor } from "../views.js";

// One fetch of app/portal.js per page, however many times a session signs in
// and out. Cleared on failure so "Try Again" genuinely tries again.
let portalCodeTask = null;

export const shellMethods = {
        // ---- Portal code ----------------------------------------------------
        // The methods behind every signed-in screen live in app/portal.js and
        // are fetched here, never at page load. Once fetched they are bound onto
        // this component exactly as Vue binds the ones declared in `methods:`,
        // so `this.saveProject()`, a template's `@click="saveProject"` and a
        // method passed along as a callback all behave as though they had been
        // there from the start.
        //
        // A failure throws. Every caller is a sign-in path, and the next thing
        // each of them does is call one of these methods — continuing without
        // them would be a TypeError rather than an error anybody could act on.
        async ensurePortalCode() {
            if (this.portalCodeLoaded) return;
            if (!portalCodeTask) {
                portalCodeTask = import('../portal.js').catch(error => {
                    portalCodeTask = null;
                    throw error;
                });
            }
            const { portalMethods, startPortal } = await portalCodeTask;
            if (this.portalCodeLoaded) return;
            for (const [name, method] of Object.entries(portalMethods)) this[name] = method.bind(this);
            this.portalCodeLoaded = true;
            startPortal(this);
        },

        // ---- Screen loading -------------------------------------------------
        // The signed-in markup is fetched from views/ rather than shipped in
        // index.html. These three are the only places that decide when.

        // Called before isLoggedIn flips, so the portal never paints a frame
        // with its own shell missing. The home screen is loaded with it, since
        // that is the one every session lands on.
        async ensurePortalViews(role) {
            const home = viewForTab(homeTabFor(role));
            const needed = [...ALWAYS_LOADED_VIEWS, home];
            // The code and the markup are fetched side by side, but the code is
            // awaited first: a view that rendered ahead of the methods its
            // buttons call would be a screen full of dead controls. Nothing
            // renders before the caller sets isLoggedIn, after both are in.
            const markup = Promise.all(needed.map(view => loadView(view)));
            // Reported below. This only keeps a markup failure from counting as
            // unhandled while the code is still arriving.
            markup.catch(() => {});
            await this.ensurePortalCode();
            try {
                await markup;
                this.viewError = '';
                this.markViewMounted(home);
            } catch (error) {
                console.error('Portal views failed to load:', error);
                this.viewError = 'Part of the portal could not be loaded. Check your connection and try again.';
            }
        },

        // Every route change lands here through the currentTab watcher, so a
        // screen reached by the sidebar, the browser Back button or a deep
        // action all load the same way.
        async ensureTabView(tabName) {
            const view = viewForTab(tabName);
            // Signing out resets currentTab, which must not start a fetch for a
            // screen nobody is looking at.
            if (!this.isLoggedIn || !view || this.mountedViews.includes(view)) return;
            this.viewLoading = true;
            try {
                await loadView(view);
                this.markViewMounted(view);
                this.viewError = '';
            } catch (error) {
                console.error(`Portal screen "${tabName}" failed to load:`, error);
                this.viewError = 'This screen could not be loaded. Check your connection and try again.';
            } finally {
                this.viewLoading = false;
            }
        },

        markViewMounted(view) {
            if (!this.mountedViews.includes(view)) this.mountedViews = [...this.mountedViews, view];
        },

        async retryPortalViews() {
            this.viewError = '';
            try {
                await this.ensurePortalViews(this.userProfile.role);
                await this.ensureTabView(this.currentTab);
            } catch (error) {
                console.error('Retrying the portal failed:', error);
                this.viewError = 'The portal could not be loaded. Check your connection and try again.';
            }
        },

        toggleSidebar() {
            if (window.innerWidth < 768) this.mobileMenuOpen = !this.mobileMenuOpen;
            else this.desktopSidebarOpen = !this.desktopSidebarOpen;
        },
        isSidebarGroupCollapsed(groupKey) {
            return Boolean(this.sidebarGroupsCollapsed[groupKey]);
        },
        toggleSidebarGroup(groupKey) {
            this.sidebarGroupsCollapsed = { ...this.sidebarGroupsCollapsed, [groupKey]: !this.sidebarGroupsCollapsed[groupKey] };
            try {
                localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(this.sidebarGroupsCollapsed));
            } catch (error) {
                // Private browsing, or storage disabled — the collapse still holds for this tab.
            }
        },
        handleSidebarWheel(event) {
            // The portal shell intentionally locks the outer page. Route a
            // mouse-wheel gesture from any part of the sidebar to its menu so
            // navigation remains reliably scrollable over buttons and labels.
            if (event.ctrlKey || !event.deltaY) return;
            const nav = event.currentTarget?.querySelector('.zq-sidebar-nav');
            if (!nav) return;
            const previousTop = nav.scrollTop;
            nav.scrollTop += event.deltaY;
            if (nav.scrollTop !== previousTop) event.preventDefault();
        },
        applyDarkModePreference() {
            this.darkMode = this.userProfile.themePreference === 'dark';
            document.documentElement.classList.toggle('dark', this.darkMode);
        },
        async toggleDarkMode() {
            this.darkMode = !this.darkMode;
            document.documentElement.classList.toggle('dark', this.darkMode);
            this.userProfile.themePreference = this.darkMode ? 'dark' : 'light';
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), { themePreference: this.userProfile.themePreference }, { merge: true });
            } catch (error) {
                console.error('Unable to save theme preference:', error);
            }
        },
        async checkForAppUpdate() {
            try {
                // version.json is a hash of every file the portal loads, the
                // page, app/ and views/ included (scripts/portal-version.js), so
                // a release that changes any one of them shows the banner.
                const response = await fetch(`/version.json?_v=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) return;
                const { version } = await response.json();
                if (!version) return;
                if (!this.appVersionMarker) { this.appVersionMarker = version; return; }
                if (version !== this.appVersionMarker) this.appUpdateAvailable = true;
            } catch (error) { /* offline or blocked request, ignore and retry next interval */ }
        },
        async refreshApp() {
            // The Client Workspace uses the same app shell as Staff. Ask the
            // browser to check the service worker first, then reload so a
            // manual Client refresh cannot keep an older app shell open.
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    await registration?.update();
                } catch (error) { /* reload still gives the network-first shell a chance to update */ }
            }
            window.location.reload();
        },
        startIdleTimeoutWatch() {
            this.stopIdleTimeoutWatch();
            const IDLE_EVENTS = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
            const armTimers = () => {
                this.idleWarningVisible = false;
                clearTimeout(this.idleWarningTimer);
                clearTimeout(this.idleLogoutTimer);
                this.idleWarningTimer = setTimeout(() => { this.idleWarningVisible = true; }, 29 * 60 * 1000);
                this.idleLogoutTimer = setTimeout(() => {
                    if (this.isLoggedIn) { this.showNotify('You were signed out after 30 minutes of inactivity.'); this.handleLogout(); }
                }, 30 * 60 * 1000);
            };
            this.idleActivityHandler = armTimers;
            IDLE_EVENTS.forEach(evt => window.addEventListener(evt, this.idleActivityHandler, { passive: true }));
            armTimers();
        },
        stopIdleTimeoutWatch() {
            clearTimeout(this.idleWarningTimer);
            clearTimeout(this.idleLogoutTimer);
            this.idleWarningTimer = null;
            this.idleLogoutTimer = null;
            this.idleWarningVisible = false;
            if (this.idleActivityHandler) {
                ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'].forEach(evt => window.removeEventListener(evt, this.idleActivityHandler));
                this.idleActivityHandler = null;
            }
        },
        staySignedIn() {
            if (this.idleActivityHandler) this.idleActivityHandler();
        },
        // A greeting on every sign-in, timed rather than dismissed. Mount it
        // hidden and flip the class on a later frame: without a painted start
        // value the browser jumps straight to the end and there is no fade in.
        playWelcomeGreeting() {
            this.clearWelcomeGreetingTimers();
            this.welcomeGreeting = { show: true, visible: false, name: this.userProfile.name || '' };
            // nextTick puts the node in the DOM, the paired frames let it paint
            // once at opacity 0 before the class flips.
            this.$nextTick(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { if (this.welcomeGreeting.show) this.welcomeGreeting.visible = true; });
                });
            });
            // Hold, fade back out, then unmount once the transition has run.
            this.welcomeGreetingTimers.push(setTimeout(() => { this.welcomeGreeting.visible = false; }, WELCOME_GREETING_HOLD_MS));
            this.welcomeGreetingTimers.push(setTimeout(() => { this.welcomeGreeting.show = false; }, WELCOME_GREETING_HOLD_MS + WELCOME_GREETING_FADE_MS));
        },
        clearWelcomeGreetingTimers() {
            this.welcomeGreetingTimers.forEach(id => clearTimeout(id));
            this.welcomeGreetingTimers = [];
        },
        switchTab(tabName) {
            // Documents, Updates and Support are panels of client-portal now, not
            // routes. Redirect rather than 404 so every existing caller keeps working.
            if (this.userProfile.role === 'Client' && CLIENT_LEGACY_TABS[tabName]) {
                this.openClientPanel(CLIENT_LEGACY_TABS[tabName]);
                return;
            }
            if (!this.hasAccess(tabName)) { this.showNotify('Access Denied: Your role does not permit access to this module.'); return; }
            if (this.currentTab === tabName) {
                this.mobileMenuOpen = false;
                this.desktopSidebarOpen = false;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            window.history.pushState({ zenqorPortal: true, tab: tabName }, '', window.location.href);
            this.currentTab = tabName;
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Own Trusted Devices list, loaded on demand the first time it's shown
            // this session — the same on-demand pattern loadClientDocuments() already
            // uses for the Client Portal's own documents. The block itself lives in
            // tab-settings.html's 'profile' branch (Account & Security / Profile &
            // RBAC), not 'settings' (Global Company Settings) — both tab ids must be
            // checked here, or the list never loads through any real navigation.
            if ((tabName === 'settings' || tabName === 'profile') && this.userProfile.uid && !this.trustedDevices.loaded) this.loadTrustedDevices();
        },
        openClientPanel(panelKey) {
            this.clientPanel = CLIENT_PANELS.some(panel => panel.key === panelKey) ? panelKey : 'ov';
            // The client's own Client Documents list is loaded on demand, the first
            // time Documents & Billing is opened — the same on-demand loadClientDocuments()
            // staff already use, just pointed at the signed-in client's own record.
            if (this.clientPanel === 'dc' && this.userProfile.role === 'Client' && this.myClientRecord?.id && !this.clientDocuments.clientDirectoryId) {
                this.loadClientDocuments(this.myClientRecord.id, this.myClientRecord.clientName, this.myClientRecord.clientEmail);
            }
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            if (this.currentTab !== 'client-portal') {
                window.history.pushState({ zenqorPortal: true, tab: 'client-portal' }, '', window.location.href);
                this.currentTab = 'client-portal';
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        clientPanelList() { return CLIENT_PANELS; },
        startClientStatusClock() {
            if (this.clientStatusClockTimer) clearInterval(this.clientStatusClockTimer);
            this.clientStatusNow = Date.now();
            // The New tag is time-derived rather than saved state. Refreshing this
            // clock makes it disappear at the 24-hour boundary on every open portal.
            this.clientStatusClockTimer = setInterval(() => { this.clientStatusNow = Date.now(); }, 1000);
        },
        stopClientStatusClock() {
            if (this.clientStatusClockTimer) clearInterval(this.clientStatusClockTimer);
            this.clientStatusClockTimer = null;
        },
        openDocumentWorkspace() {
            if (!this.hasAccess('document-quotations')) { this.showNotify('Access Denied: Your role does not permit access to documents.'); return; }
            this.switchTab('document-quotations');
        },
        returnToDashboard() {
            this.switchTab(homeTabFor(this.userProfile.role));
        },
        restoreTabFromHistory(tabName) {
            const homeTab = homeTabFor(this.userProfile.role);
            const resolvedTab = tabName === 'document-invoices' ? 'document-quotations' : tabName;
            const safeTab = typeof resolvedTab === 'string' && this.hasAccess(resolvedTab) ? resolvedTab : homeTab;
            this.currentTab = safeTab;
            this.mobileMenuOpen = false;
            this.desktopSidebarOpen = false;
            window.scrollTo({ top: 0, behavior: 'auto' });
        },
        requestLogout() {
            this.logoutConfirm = true;
        },
        selectAuthView(view) {
            this.authView = view;
            this.loginError = '';
        }
};