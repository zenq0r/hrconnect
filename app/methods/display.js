// Presentation helpers shared by every screen: initials and photos, currency
// and date formatting, and the PDPA masking applied to IC, bank and EPF/SOCSO
// numbers.
export const displayMethods = {
        getInitials(name) {
            const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (!parts.length) return '?';
            return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
        },
        projectOwnerPhoto(project) {
            if (project?.ownerPhoto) return project.ownerPhoto;
            const email = String(project?.ownerEmail || '').trim().toLowerCase();
            if (!email) return '';
            const matchedUser = this.users.find(u => String(u.email || '').trim().toLowerCase() === email);
            return matchedUser?.photo || '';
        },
        employeePhotoByEmail(email) {
            const normalized = String(email || '').trim().toLowerCase();
            if (!normalized) return '';
            const matchedUser = this.users.find(u => String(u.email || '').trim().toLowerCase() === normalized);
            return matchedUser?.photo || '';
        },
        payEmployeePhoto() { return this.employeePhotoByEmail(this.payForm?.empEmail); },
        claimEmployeePhoto() { return this.employeePhotoByEmail(this.claimForm?.empEmail); },
        voucherEmployeePhoto() { return this.employeePhotoByEmail(this.voucherForm?.empEmail); },

        maskSensitive(val) {
            if (!val) return '-';
            const digits = String(val).replace(/\D/g, '');
            const lastFour = (digits || String(val).trim()).slice(-4);
            return `XXXXX${lastFour}`;
        },
        maskIC(val) { return this.maskSensitive(val); },
        maskBank(val) { return this.maskSensitive(val); },
        maskEpfSocso(val) {
            if (!val) return '-';
            return String(val).replace(/(KWSP|EPF|PERKESO|SOCSO)\s*:\s*([^|]+)/gi, (match, label, number) => `${label}: ${this.maskSensitive(number)}`);
        },
        formatCurrency(val) {
            return new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(val || 0);
        },
        formatDateTime(val) {
            return val ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(val)) : '-';
        },
        formatDateWithDay(val) {
            if (!val) return '-';
            const raw = typeof val === 'string' && val.length === 10 ? `${val}T00:00:00` : val;
            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) return '-';
            return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
        },
        formatDateTimeWithDay(val) {
            if (!val) return '-';
            const parsed = new Date(val);
            if (Number.isNaN(parsed.getTime())) return '-';
            return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
        },
        getLocalDateKey(value = new Date()) {
            const date = value instanceof Date ? value : new Date(value);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
};