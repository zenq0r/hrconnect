// Search, sort and pagination for the record tables, and the overlay flag the
// global scroll lock watches.
export const tablesComputed = {

        // PAGINATION & SORTING UNTUK CLAIMS MODULE
        filteredSortedClaims() {
            let list = [...this.claimsHistory];
            
            list.sort((a, b) => {
                if (this.claimsSortOption === 'latest') return new Date(b.expenseDate) - new Date(a.expenseDate);
                if (this.claimsSortOption === 'oldest') return new Date(a.expenseDate) - new Date(b.expenseDate);
                if (this.claimsSortOption === 'category') return (a.category || '').localeCompare(b.category || '');
                if (this.claimsSortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.claimsSortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.expenseDate) - new Date(a.expenseDate);
            });

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(c => 
                    (c.receiptNo && c.receiptNo.toLowerCase().includes(q)) ||
                    (c.name && c.name.toLowerCase().includes(q)) ||
                    (c.empNo && c.empNo.toLowerCase().includes(q)) ||
                    (c.category && c.category.toLowerCase().includes(q))
                );
            }
            return list;
        },
        claimsTotalPages() { return Math.ceil(this.filteredSortedClaims.length / this.claimsItemsPerPage) || 1; },
        paginatedClaims() {
            const start = (this.claimsCurrentPage - 1) * this.claimsItemsPerPage;
            return this.filteredSortedClaims.slice(start, start + this.claimsItemsPerPage);
        },

        // PAGINATION & SORTING UNTUK PAYMENT VOUCHER MODULE
        filteredSortedVouchers() {
            let list = [...this.paymentVouchers];

            list.sort((a, b) => {
                if (this.vouchersSortOption === 'latest') return new Date(b.paymentDate || b.expenseDate) - new Date(a.paymentDate || a.expenseDate);
                if (this.vouchersSortOption === 'oldest') return new Date(a.paymentDate || a.expenseDate) - new Date(b.paymentDate || b.expenseDate);
                if (this.vouchersSortOption === 'category') return (a.category || '').localeCompare(b.category || '');
                if (this.vouchersSortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.vouchersSortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.paymentDate || b.expenseDate) - new Date(a.paymentDate || a.expenseDate);
            });

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(v =>
                    (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
                    (v.payeeName && v.payeeName.toLowerCase().includes(q)) ||
                    (v.name && v.name.toLowerCase().includes(q)) ||
                    (v.empNo && v.empNo.toLowerCase().includes(q)) ||
                    (v.category && v.category.toLowerCase().includes(q))
                );
            }
            return list;
        },
        vouchersTotalPages() { return Math.ceil(this.filteredSortedVouchers.length / this.vouchersItemsPerPage) || 1; },
        paginatedVouchers() {
            const start = (this.vouchersCurrentPage - 1) * this.vouchersItemsPerPage;
            return this.filteredSortedVouchers.slice(start, start + this.vouchersItemsPerPage);
        },

        filteredRecentActivities() {
            const combined = [
                ...this.docHistory.map(d => ({ ...d, tagClass: d.type === 'Invoice' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', isDoc: true })),
                ...this.payslipHistory.map(p => ({ ...p, tagClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', isPay: true })),
                ...this.claimsHistory.map(c => ({ ...c, tagClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200', isClaim: true, docNo: c.receiptNo, amount: c.amount, date: c.expenseDate, name: c.name })),
                ...this.paymentVouchers.map(v => ({ ...v, tagClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200', isVoucher: true, type: 'Payment Voucher', docNo: v.voucherNo, amount: v.amount, date: v.paymentDate, name: v.payeeName || v.name }))
            ];
            const typePriority = { 'Payslip': 1, 'Quotation': 2, 'Invoice': 3, 'Claim': 4, 'Payment Voucher': 5 };
            let list = combined.sort((a, b) => {
                if (this.sortOption === 'latest') return new Date(b.date) - new Date(a.date);
                if (this.sortOption === 'oldest') return new Date(a.date) - new Date(b.date);
                if (this.sortOption === 'module') {
                    const priorityA = typePriority[a.type] || 99;
                    const priorityB = typePriority[b.type] || 99;
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return new Date(b.date) - new Date(a.date);
                }
                if (this.sortOption === 'amount_high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                if (this.sortOption === 'amount_low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                return new Date(b.date) - new Date(a.date);
            });
            if (this.recentActivityFilter !== 'all') {
                list = list.filter(c => (c.documentType || c.type) === this.recentActivityFilter);
            }
            if (this.recentActivityAttentionOnly) {
                list = list.filter(c => (c.type === 'Invoice' && c.status !== 'Paid') || ((c.isClaim || c.isVoucher) && String(c.status || '').startsWith('Pending')));
            }
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                list = list.filter(c => (c.docNo && c.docNo.toLowerCase().includes(q)) || (c.name && c.name.toLowerCase().includes(q)) || (c.type && c.type.toLowerCase().includes(q)) || (c.raw && c.raw.clientSSM && c.raw.clientSSM.toLowerCase().includes(q)) || (c.raw && c.raw.ic && c.raw.ic.toLowerCase().includes(q)));
            }
            return list;
        },
        totalPages() { return Math.ceil(this.filteredRecentActivities.length / this.itemsPerPage) || 1; },
        paginatedActivities() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            return this.filteredRecentActivities.slice(start, start + this.itemsPerPage);
        },
        // Audit & Security Log's own list — an unfilterable log is only usable
        // for as long as it fits on one screen. Matches by user, action, the
        // module/details text and the target UID, so "who did what to which
        // record" is answerable without scrolling the whole history.
        filteredAuditLogs() {
            if (!this.searchQuery) return this.auditLogs;
            const q = this.searchQuery.toLowerCase();
            return this.auditLogs.filter(log => [log.userName, log.user, log.role, log.action, log.module, log.details, log.uid]
                .some(field => String(field || '').toLowerCase().includes(q)));
        },
        // Not a "correct" value to enforce — retention is the company's own call
        // to make, not this portal's. Only flags that the currently configured
        // period is short enough (under 90 days) that it is worth a deliberate
        // look, since financial/security audit trails commonly need to survive
        // 1-7 years for compliance, and 30 days is only ever the unconfigured
        // default here, never a decision someone actually made.
        auditRetentionIsShort() {
            const UNIT_DAYS = { hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };
            const days = (Number(this.auditRetention.value) || 0) * (UNIT_DAYS[this.auditRetention.unit] || 1);
            return days > 0 && days < 90;
        },
        // Drives the global body-scroll lock (see the matching watch below) — every
        // modal/drawer/dropdown/context-menu overlay in the app, OR'd together, so
        // locking/restoring scroll needs exactly one implementation instead of
        // per-modal wiring. Kept in the same order as globalEscapeHandler for easy
        // cross-checking; add new overlays to both together.
        anyOverlayOpen() {
            return this.markProjectDoneModal.show || this.appConfirm.show || this.employeeView.show ||
                this.clientView.show ||
                (this.clientUpdateModal.show && this.clientUpdateModal.project) ||
                this.websiteContentModal.show || this.siteTextModal.show ||
                (this.activityModal.show && this.activityModal.project) ||
                (this.projectPreview.show && this.projectPreview.project) ||
                this.projectModal.show ||
                this.logoutConfirm || this.postLogoutChoice ||
                this.clientActionConfirm.show || this.employeeActionConfirm.show ||
                this.contextMenu.show || this.clientTaskModal.show ||
                this.idleWarningVisible || this.employeeModal.show || this.userModal.show ||
                this.staffPortalAccount.show || this.accessRequestModal.show ||
                this.changePasswordModal.show ||
                this.claimPreview.show || this.attachmentPreview.show || this.recordPreview.show ||
                this.notificationsPanelOpen || this.staffDirectoryPanelOpen;
        }
    
};