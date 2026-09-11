// Portal chrome: sidebar, dark mode, tab routing, idle sign-out, the welcome
// greeting and the new-version check.
import {
    db,
    doc,
    setDoc
} from "../../firebase-config.js";
import { WELCOME_GREETING_HOLD_MS, WELCOME_GREETING_FADE_MS } from "../config.js";
import { CLIENT_PANELS, CLIENT_LEGACY_TABS } from "../constants/client-tiers.js";
export const shellMethods = {

        toggleSidebar() {
            if (window.innerWidth < 768) this.mobileMenuOpen = !this.mobileMenuOpen;
            else this.desktopSidebarOpen = !this.desktopSidebarOpen;
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
                // Watches every file a deploy can change on its own: the page,
                // the application logic, and the stylesheet. Any one of them
                // shipping alone is a real release, and a check that missed it
                // left the banner silent for that release.
                const [pageResponse, scriptResponse, styleResponse] = await Promise.all([
                    fetch(`${window.location.pathname}?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }),
                    fetch(`/app.js?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }),
                    fetch(`/custom.css?_v=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
                ]);
                const markerOf = response => response.headers.get('etag') || response.headers.get('last-modified') || '';
                const pageMarker = markerOf(pageResponse);
                const scriptMarker = markerOf(scriptResponse);
                const styleMarker = markerOf(styleResponse);
                if (!pageMarker && !scriptMarker && !styleMarker) return;
                const marker = `${pageMarker}|${scriptMarker}|${styleMarker}`;
                if (!this.appVersionMarker) { this.appVersionMarker = marker; return; }
                if (marker !== this.appVersionMarker) this.appUpdateAvailable = true;
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
        },
        openClientPanel(panelKey) {
            this.clientPanel = CLIENT_PANELS.some(panel => panel.key === panelKey) ? panelKey : 'ov';
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
            if (this.userProfile.role === 'Client') this.switchTab('client-portal');
            else this.switchTab('dashboard');
        },
        restoreTabFromHistory(tabName) {
            const homeTab = this.userProfile.role === 'Client' ? 'client-portal' : 'dashboard';
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