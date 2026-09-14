// Accounting-period scoping and every dashboard/report aggregate derived from
// the records inside the selected month.
export const reportsComputed = {

        // ---- Monthly accounting period ----------------------------------
        // Dashboard money figures are per-period so each month opens at zero.
        // Only FLOW figures reset (issued, collected, paid out); BALANCE figures
        // such as pending receivables stay cumulative — last month's unpaid
        // invoice is still owed on the 1st, and zeroing it would hide real debt.
        currentPeriod() { return this.periodKeyOf(new Date().toISOString()); },
        currentPeriodLabel() { return this.periodLabel(this.currentPeriod); },

        // The KPI strip can be stepped back through closed months. Everything
        // below reads dashboardPeriod, never currentPeriod, so one control
        // moves the whole strip; the Reports tab keeps its own live period.
        dashboardPeriod() { return this.dashboardPeriodKey || this.currentPeriod; },
        dashboardPeriodLabel() { return this.periodLabel(this.dashboardPeriod); },
        isCurrentDashboardPeriod() { return this.dashboardPeriod === this.currentPeriod; },
        // Twelve months of history is as far back as the strip reaches.
        dashboardPeriodFloor() {
            const now = new Date();
            const floor = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            return `${floor.getFullYear()}-${String(floor.getMonth() + 1).padStart(2, '0')}`;
        },
        canViewOlderDashboardPeriod() { return this.dashboardPeriod > this.dashboardPeriodFloor; },

        periodDocs() { return this.docHistory.filter(d => this.periodKeyOf(d.date) === this.dashboardPeriod); },
        periodPayslips() { return this.payslipHistory.filter(p => this.periodKeyOf(p.date) === this.dashboardPeriod); },
        periodClaims() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => this.periodKeyOf(this.claimDateOf(c)) === this.dashboardPeriod); },

        periodQuotationCount() { return this.periodDocs.filter(d => d.type === 'Quotation').length; },
        periodInvoiceCount() { return this.periodDocs.filter(d => d.type === 'Invoice').length; },
        periodRevenuePaid() { return this.periodDocs.filter(d => d.type === 'Invoice' && d.status === 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        periodPayrollNet() { return this.periodPayslips.reduce((s, p) => s + (Number(p.amount) || 0), 0); },
        periodApprovedClaimsAmount() { return this.periodClaims.filter(c => c.status === 'Approved').reduce((s, c) => s + (Number(c.amount) || 0), 0); },

        // Newest first, so the Reports list reads as a statement history.
        monthlyArchivesSorted() { return [...this.monthlyArchives].sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''))); },
        // Every period that has at least one record, for the export scope picker.
        availablePeriods() {
            const keys = new Set();
            this.docHistory.forEach(d => { const k = this.periodKeyOf(d.date); if (k) keys.add(k); });
            this.payslipHistory.forEach(p => { const k = this.periodKeyOf(p.date); if (k) keys.add(k); });
            [...this.claimsHistory, ...this.paymentVouchers].forEach(c => { const k = this.periodKeyOf(this.claimDateOf(c)); if (k) keys.add(k); });
            return [...keys].sort().reverse();
        },

        totalQuotations() { return this.docHistory.filter(d => d.type === 'Quotation').length; },
        totalQuotationValue() { return this.docHistory.filter(d => d.type === 'Quotation').reduce((s, d) => s + (Number(d.amount) || 0), 0); },
        // 'Open' is a quotation that has been sent and is still awaiting the
        // Client's Accept/Reject decision — the dashboard's "Quotation Pending" KPI.
        pendingQuotationsCount() { return this.docHistory.filter(d => d.type === 'Quotation' && d.status === 'Open').length; },
        paidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').length; },
        unpaidInvoicesCount() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').length; },

        totalRevenuePending() { return this.docHistory.filter(d => d.type === 'Invoice' && d.status !== 'Paid').reduce((s, d) => s + (Number(d.amount) || 0), 0); },

        activeEmployeesCount() { return this.employees.filter(e => e.status === 'Aktif').length; },
        // Mirrors clientActiveProjectsCount (app/computed/client-portal.js) for the
        // staff-facing KPI strip.
        activeProjectsCount() { return this.projects.filter(p => p.status !== 'Completed & Done').length; },

        // CROSS-SYSTEM INSIGHT: staff workload measured across BOTH HR project assignments and client
        // activity assignments — only possible because HR and Client data live in the same system.
        employeeWorkload() {
            return this.employees
                .map(emp => {
                    const projectAssignments = this.employeeActiveProjectAssignments(emp.empNo);
                    const activityAssignments = this.employeeActiveActivityAssignments(emp.empNo);
                    const clientNames = [...new Set(projectAssignments.map(p => p.clientName).filter(Boolean))];
                    return { emp, projectCount: projectAssignments.length, activityCount: activityAssignments.length, clientCount: clientNames.length, total: projectAssignments.length + activityAssignments.length };
                })
                .filter(w => w.total > 0)
                .sort((a, b) => b.total - a.total);
        },
        overloadedEmployeeCount() { return this.employeeWorkload.filter(w => w.total >= 4).length; },

        // CROSS-SYSTEM INSIGHT: revenue attributed per client, ranked — combines Client Directory with Billing data.
        revenuePerClientTop() {
            const byClient = {};
            this.docHistory.filter(d => d.type === 'Invoice' && d.status === 'Paid').forEach(d => {
                const key = d.name || 'Unknown';
                byClient[key] = (byClient[key] || 0) + (Number(d.amount) || 0);
            });
            return Object.entries(byClient).map(([clientName, revenue]) => ({ clientName, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
        },
        // CROSS-SYSTEM INSIGHT: distinct HR staff engaged per client, ranked.
        staffPerClientTop() {
            const byClient = {};
            this.projects.forEach(p => {
                if (!p.clientName) return;
                if (!byClient[p.clientName]) byClient[p.clientName] = new Set();
                if (p.ownerEmpNo) byClient[p.clientName].add(p.ownerEmpNo);
            });
            return Object.entries(byClient).map(([clientName, staffSet]) => ({ clientName, staffCount: staffSet.size })).filter(c => c.staffCount > 0).sort((a, b) => b.staffCount - a.staffCount).slice(0, 6);
        },
        avgActiveProjectAgeDays() {
            const active = this.projects.filter(p => p.status !== 'Completed & Done' && p.createdAt);
            if (!active.length) return 0;
            const totalDays = active.reduce((s, p) => s + Math.max(0, (Date.now() - Date.parse(p.createdAt)) / 86400000), 0);
            return Math.round(totalDays / active.length);
        },

        pendingClaimsCount() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status && c.status.includes('Pending')).length; },
        financePendingClaims() { return [...this.claimsHistory, ...this.paymentVouchers].filter(c => c.status === 'Pending Account'); }
};