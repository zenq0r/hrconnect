// Toasts and the notification panel, including the tone a message is read in.
import {
    db,
    doc,
    setDoc,
    updateDoc
} from "../../firebase-config.js";
export const notificationMethods = {
        // Every toast used to render a success tick, so "Unable to delete this
        // account" arrived wearing the same green check as a completed save.
        // Callers may state the tone; when they don't, clear failure wording is
        // read as a failure rather than assumed to be good news.
        notificationTone(msg) {
            // "Only X may …" is how this codebase words a refusal — all 21 of
            // them are denials, and no success message opens that way.
            return /^(unable|access denied|failed|only|error)\b|\b(cannot|could not|couldn't|failed|error|denied|not permitted|no permission|do not have (permission|access)|does not permit|refused|rejected)\b/i.test(String(msg || ''))
                ? 'error'
                : 'success';
        },
        showNotify(msg, tone = '') {
            this.notification = { show: true, message: msg, tone: tone || this.notificationTone(msg) };
            setTimeout(() => { this.notification.show = false; }, 3500);
            this.notificationsLog.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message: msg, read: false, timestamp: new Date().toISOString() });
            if (this.notificationsLog.length > 30) this.notificationsLog.length = 30;
            this.scheduleNotificationsSync();
        },
        scheduleNotificationsSync() {
            if (!this.userProfile.uid) return;
            if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
            this.notificationsSyncTimer = setTimeout(() => this.syncNotificationsLog(), 2500);
        },
        async syncNotificationsLog() {
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid), { notificationsLog: this.notificationsLog }, { merge: true });
            } catch (error) {
                console.error('Unable to sync notifications log:', error);
            }
        },
        toggleNotificationsPanel() {
            this.notificationsPanelOpen = !this.notificationsPanelOpen;
        },
        toggleStaffDirectoryPanel() {
            this.staffDirectoryPanelOpen = !this.staffDirectoryPanelOpen;
        },
        async markAllNotificationsRead() {
            this.notificationsLog.forEach(n => { n.read = true; });
            this.syncNotificationsLog();
            const unreadPortal = this.portalNotifications.filter(notification => !notification.read && !notification.hiddenAt);
            await Promise.all(unreadPortal.map(notification => updateDoc(doc(db, 'portal_notifications', notification.id), { read: true, readAt: new Date().toISOString() }).catch(error => console.warn('Unable to mark website notification as read:', error))));
        },
        async clearNotificationsLog() {
            this.notificationsLog = [];
            this.notificationsPanelOpen = false;
            this.syncNotificationsLog();
            const visiblePortal = this.portalNotifications.filter(notification => !notification.hiddenAt);
            await Promise.all(visiblePortal.map(notification => updateDoc(doc(db, 'portal_notifications', notification.id), { hiddenAt: new Date().toISOString() }).catch(error => console.warn('Unable to hide website notification:', error))));
        }
};