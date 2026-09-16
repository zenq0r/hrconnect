// Toasts and the notification panel, including the tone a message is read in.
import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteField
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
            const resolvedTone = tone || this.notificationTone(msg);
            this.notification = { show: true, message: msg, tone: resolvedTone };
            setTimeout(() => { this.notification.show = false; }, 3500);
            // Every one of these used to go straight into the persisted bell
            // feed too — hundreds of routine confirmations, validation
            // refusals and other people's "is now online" pings a minute
            // apart, none of it worth scrolling back through later. The toast
            // above already told the person what just happened, in the
            // moment; the feed is now reserved for the messages actually
            // worth a permanent record — this account's own successful,
            // non-routine actions — and cross-user business events still
            // arrive separately via portal_notifications (see
            // notificationsForDisplay()), unaffected by this.
            if (this.isNotableForNotificationsLog(msg, resolvedTone)) {
                this.notificationsLog.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message: msg, read: false, timestamp: new Date().toISOString() });
                if (this.notificationsLog.length > 30) this.notificationsLog.length = 30;
                this.scheduleNotificationsSync();
            }
        },
        // Deliberately conservative: exclude the two clear, high-volume
        // categories of noise (another user's presence, and this user's own
        // permission/validation refusals) rather than trying to enumerate
        // every message worth keeping.
        isNotableForNotificationsLog(msg, tone) {
            if (tone === 'error') return false;
            if (/\bis now (online|offline)\.?$/i.test(String(msg || ''))) return false;
            return true;
        },
        scheduleNotificationsSync() {
            if (!this.userProfile.uid) return;
            if (this.notificationsSyncTimer) clearTimeout(this.notificationsSyncTimer);
            this.notificationsSyncTimer = setTimeout(() => this.syncNotificationsLog(), 2500);
        },
        async syncNotificationsLog() {
            if (!this.userProfile.uid) return;
            try {
                await setDoc(doc(db, 'users', this.userProfile.uid, 'private', 'notifications'), { log: this.notificationsLog });
            } catch (error) {
                console.error('Unable to sync notifications log:', error);
            }
        },
        // The history is kept in users/{uid}/private/notifications. It used to be
        // a field on users/{uid}, which every staff session reads for the
        // directory, so everyone could read everyone's toasts. A record still
        // carrying the old field has it moved across and removed on sign-in.
        async loadNotificationsLog(userData) {
            const uid = this.userProfile.uid;
            if (!uid) return;
            const legacy = Array.isArray(userData?.notificationsLog) ? userData.notificationsLog : null;
            try {
                const snapshot = await getDoc(doc(db, 'users', uid, 'private', 'notifications'));
                const stored = snapshot.exists() && Array.isArray(snapshot.data().log) ? snapshot.data().log : null;
                this.notificationsLog = stored || legacy || [];
                if (legacy) {
                    if (!stored) await setDoc(doc(db, 'users', uid, 'private', 'notifications'), { log: legacy });
                    await updateDoc(doc(db, 'users', uid), { notificationsLog: deleteField() });
                }
            } catch (error) {
                console.warn('Unable to load the notification history:', error);
                this.notificationsLog = legacy || [];
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