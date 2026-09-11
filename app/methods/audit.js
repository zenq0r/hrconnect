// Audit trail writes and the retention (TTL) setting behind them.
import {
    auth
} from "../../firebase-config.js";
export const auditMethods = {
        async logAudit(action, details) {
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) return;
                const idToken = await firebaseUser.getIdToken();
                const response = await fetch('/api/audit-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ action, details, module: this.currentTab })
                });
                if (!response.ok) throw new Error(`Audit API returned ${response.status}`);
            } catch (error) {
                console.error('Unable to record audit event:', error);
            }
        },
        async loadAuditRetention() {
            if (!['Superadmin', 'Director', 'IT'].includes(this.userProfile.role)) return;
            this.auditRetention.loading = true;
            this.auditRetention.error = '';
            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/audit-retention', { headers: { 'Authorization': `Bearer ${idToken}` } });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Unable to load retention settings.');
                this.auditRetention.value = data.value;
                this.auditRetention.unit = data.unit;
            } catch (error) {
                this.auditRetention.error = error.message || 'Unable to load retention settings.';
            } finally {
                this.auditRetention.loading = false;
            }
        },
        async saveAuditRetention() {
            this.auditRetention.saving = true;
            this.auditRetention.message = '';
            this.auditRetention.error = '';
            try {
                const idToken = await auth.currentUser.getIdToken();
                const response = await fetch('/api/audit-retention', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                    body: JSON.stringify({ value: Number(this.auditRetention.value), unit: this.auditRetention.unit })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Unable to save retention settings.');
                this.auditRetention.message = `Retention saved. ${data.updatedRecords} existing audit record(s) scheduled for automatic cleanup.`;
                this.logAudit('UPDATE', `Audit retention set to ${data.value} ${data.unit}(s)`);
            } catch (error) {
                this.auditRetention.error = error.message || 'Unable to save retention settings.';
            } finally {
                this.auditRetention.saving = false;
            }
        }
};