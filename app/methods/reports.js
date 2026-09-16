// Accounting periods, monthly archives and every export (CSV, period summary,
// statutory compliance report).
import {
    db,
    doc,
    setDoc
} from "../../firebase-config.js";
export const reportMethods = {
        // ---- Monthly period helpers -------------------------------------
        // Records carry a plain YYYY-MM-DD string, so slicing beats Date parsing:
        // it cannot drift across timezones the way new Date(...) can near midnight.
        periodKeyOf(value) {
            const raw = String(value || '').trim();
            if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
            const parsed = new Date(raw);
            if (isNaN(parsed.getTime())) return '';
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
        },
        // Step the executive KPI strip one month at a time. The live month is
        // stored as an empty key so the strip follows the calendar forward.
        shiftDashboardPeriod(delta) {
            const [year, month] = this.dashboardPeriod.split('-').map(Number);
            const moved = new Date(year, (month - 1) + delta, 1);
            const key = `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
            if (key > this.currentPeriod) return;
            if (key < this.dashboardPeriodFloor) return;
            this.dashboardPeriodKey = key === this.currentPeriod ? '' : key;
        },
        resetDashboardPeriod() { this.dashboardPeriodKey = ''; },
        // Claims and vouchers each carry their own date field name.
        claimDateOf(record) { return record?.date || record?.expenseDate || record?.paymentDate || record?.createdAt || ''; },
        periodLabel(key) {
            const raw = String(key || '');
            if (!/^\d{4}-\d{2}$/.test(raw)) return raw || 'All periods';
            const [year, month] = raw.split('-');
            const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return `${names[Number(month) - 1] || month} ${year}`;
        },
        // Records belonging to one period, grouped the same way every caller needs them.
        recordsForPeriod(period) {
            const docs = this.docHistory.filter(d => !period || this.periodKeyOf(d.date) === period);
            const payslips = this.payslipHistory.filter(p => !period || this.periodKeyOf(p.date) === period);
            const claims = [...this.claimsHistory, ...this.paymentVouchers].filter(c => !period || this.periodKeyOf(this.claimDateOf(c)) === period);
            return { docs, payslips, claims };
        },

        // ---- Attendance summary -------------------------------------------
        // A Firestore Timestamp (what clockInAt/clockOutAt resolve to once read
        // back from a snapshot) needs toDate()/toMillis() first — it is not a
        // value `new Date()` understands the way a plain ISO string is.
        timestampToMillis(value) {
            if (!value) return 0;
            if (typeof value.toMillis === 'function') return value.toMillis();
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        },
        attendanceHoursFor(record) {
            const inMs = this.timestampToMillis(record.clockInAt);
            const outMs = this.timestampToMillis(record.clockOutAt);
            if (!inMs || !outMs || outMs <= inMs) return 0;
            return (outMs - inMs) / 3600000;
        },
        // The earliest Published shift assigning this empNo on this date, if
        // any. "Late" is judged against whichever shift they were actually
        // rostered on — this app has no single fixed office-hours assumption,
        // since Duty Roster is how shifts are actually assigned.
        shiftStartTimeFor(empNo, date) {
            let earliest = null;
            this.dutyRosterWeeks.forEach(week => {
                if (week.status !== 'Published') return;
                (week.shifts || []).forEach(shift => {
                    if (shift.date !== date || !(shift.assignedEmpNos || []).includes(empNo)) return;
                    if (!earliest || shift.startTime < earliest) earliest = shift.startTime;
                });
            });
            return earliest;
        },
        attendanceIsLate(record) {
            const shiftStart = this.shiftStartTimeFor(record.empNo, record.date);
            if (!shiftStart || !record.clockInAt) return false;
            const clockInMs = this.timestampToMillis(record.clockInAt);
            if (!clockInMs) return false;
            const clockInDate = new Date(clockInMs);
            const actual = `${String(clockInDate.getHours()).padStart(2, '0')}:${String(clockInDate.getMinutes()).padStart(2, '0')}`;
            return actual > shiftStart;
        },
        // Every date within `period` (YYYY-MM, or '' for all periods) that a
        // Published roster assigned a shift to a given empNo — the baseline
        // "was scheduled to work" that turns a missing attendance record into
        // a real Absent, rather than assuming every weekday is a workday.
        scheduledDatesByEmpNoForPeriod(period) {
            const map = {};
            this.dutyRosterWeeks.forEach(week => {
                if (week.status !== 'Published') return;
                (week.shifts || []).forEach(shift => {
                    if (period && this.periodKeyOf(shift.date) !== period) return;
                    (shift.assignedEmpNos || []).forEach(empNo => {
                        if (!map[empNo]) map[empNo] = new Set();
                        map[empNo].add(shift.date);
                    });
                });
            });
            return map;
        },
        attendanceRecordsForPeriod(period) {
            return this.attendanceRecords.filter(r => !period || this.periodKeyOf(r.date) === period);
        },
        // Per-employee Days Present / Hours Worked / Late / Absent for one
        // period, plus the totals row. Present is any clock-in on record
        // (clocked out or not); Absent counts only dates a Published roster
        // actually scheduled the employee to work.
        attendanceSummaryForPeriod(period) {
            const records = this.attendanceRecordsForPeriod(period);
            const scheduled = this.scheduledDatesByEmpNoForPeriod(period);
            const byEmp = {};
            const ensureRow = (empNo, name) => {
                if (!byEmp[empNo]) byEmp[empNo] = { empNo, name: name || empNo, daysPresent: 0, hoursWorked: 0, lateCount: 0, absentCount: 0 };
                return byEmp[empNo];
            };
            records.forEach(record => {
                const row = ensureRow(record.empNo, record.name);
                row.daysPresent += 1;
                row.hoursWorked += this.attendanceHoursFor(record);
                if (this.attendanceIsLate(record)) row.lateCount += 1;
            });
            Object.entries(scheduled).forEach(([empNo, dates]) => {
                const employee = this.employees.find(e => e.empNo === empNo);
                const row = ensureRow(empNo, employee?.name);
                const attendedDates = new Set(records.filter(r => r.empNo === empNo).map(r => r.date));
                dates.forEach(date => { if (!attendedDates.has(date)) row.absentCount += 1; });
            });
            const rows = Object.values(byEmp).sort((a, b) => a.name.localeCompare(b.name));
            const totals = rows.reduce((acc, row) => ({
                daysPresent: acc.daysPresent + row.daysPresent,
                hoursWorked: acc.hoursWorked + row.hoursWorked,
                lateCount: acc.lateCount + row.lateCount,
                absentCount: acc.absentCount + row.absentCount
            }), { daysPresent: 0, hoursWorked: 0, lateCount: 0, absentCount: 0 });
            return { rows, totals };
        },
        // Frozen totals for one closed month. Money is rounded to sen here so the
        // stored package matches what was exported, rather than re-deriving later.
        buildPeriodSummary(period) {
            const { docs, payslips, claims } = this.recordsForPeriod(period);
            const sum = (list, filter) => Number(list.filter(filter).reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2));
            const quotations = docs.filter(d => d.type === 'Quotation');
            const invoices = docs.filter(d => d.type === 'Invoice');
            const vouchers = claims.filter(c => (c.documentType || c.type) === 'Payment Voucher');
            const expenseClaims = claims.filter(c => (c.documentType || c.type) !== 'Payment Voucher');
            return {
                period,
                label: this.periodLabel(period),
                quotationCount: quotations.length,
                quotationValue: sum(quotations, () => true),
                invoiceCount: invoices.length,
                invoicePaidCount: invoices.filter(d => d.status === 'Paid').length,
                revenueCollected: sum(invoices, d => d.status === 'Paid'),
                revenueOutstanding: sum(invoices, d => d.status !== 'Paid'),
                payslipCount: payslips.length,
                payrollNet: sum(payslips, () => true),
                claimCount: expenseClaims.length,
                claimApprovedTotal: sum(expenseClaims, c => c.status === 'Approved'),
                voucherCount: vouchers.length,
                voucherApprovedTotal: sum(vouchers, c => c.status === 'Approved'),
                recordCount: docs.length + payslips.length + claims.length
            };
        },

        // Freezes every completed month that has records but no package yet.
        // Runs on load rather than on a schedule: the portal is a static site with
        // no cron, so the first sign-in on or after the 1st performs the close.
        async ensureMonthlyArchives() {
            if (this.monthlyArchiveRunning) return;
            // Closing writes company-wide financial summaries; a Client or Staff
            // session must never author them.
            if (!this.canCloseAccountingPeriod) return;
            this.monthlyArchiveRunning = true;
            try {
                const current = this.currentPeriod;
                const archived = new Set(this.monthlyArchives.map(a => a.period || a.id));
                // Only months strictly before the current one are final.
                const pending = this.availablePeriods.filter(p => p && p < current && !archived.has(p));
                if (!pending.length) return;
                let closed = 0;
                for (const period of pending) {
                    const summary = this.buildPeriodSummary(period);
                    if (!summary.recordCount) continue;
                    await setDoc(doc(db, 'monthly_archives', period), {
                        ...summary,
                        closedAt: new Date().toISOString(),
                        closedByUid: this.userProfile.uid || '',
                        closedByName: this.userProfile.name || ''
                    }, { merge: true });
                    this.logAudit('ARCHIVE', `Closed accounting period ${summary.label}`);
                    closed += 1;
                }
                if (closed) this.showNotify(`${closed} completed month${closed > 1 ? 's' : ''} packaged into Reports & Data Export.`);
            } catch (error) {
                // A failed close is not worth blocking the workspace over — the next
                // sign-in retries, and no records are altered either way.
                console.error('Monthly archive failed:', error);
            } finally {
                this.monthlyArchiveRunning = false;
            }
        },
        // Re-freeze one month on demand, for a period edited after it closed.
        async rebuildMonthlyArchive(period) {
            if (!this.canCloseAccountingPeriod) { this.showNotify('You do not have permission to close accounting periods.'); return; }
            const summary = this.buildPeriodSummary(period);
            if (!await this.askConfirm({
                title: `Rebuild ${summary.label}?`,
                message: `The stored package for ${summary.label} will be replaced with the ${summary.recordCount} record(s) currently in the system. No records are changed.`,
                confirmLabel: 'Yes, Rebuild'
            })) return;
            try {
                await setDoc(doc(db, 'monthly_archives', period), {
                    ...summary,
                    closedAt: new Date().toISOString(),
                    closedByUid: this.userProfile.uid || '',
                    closedByName: this.userProfile.name || ''
                }, { merge: true });
                this.logAudit('ARCHIVE', `Rebuilt accounting period ${summary.label}`);
                this.showNotify(`${summary.label} package rebuilt.`);
            } catch (error) {
                console.error('Monthly archive rebuild failed:', error);
                this.showNotify('Unable to rebuild this period package.');
            }
        },
        // One CSV covering a whole month: the frozen summary, then every record
        // behind it, so the file stands alone as that period's statement.
        exportPeriodSummary(period) {
            const summary = this.buildPeriodSummary(period);
            const { docs, payslips, claims } = this.recordsForPeriod(period);
            const money = value => Number(value || 0).toFixed(2);
            const rows = [
                ['ZENQOR HRMS/CDTS - MONTHLY STATEMENT'],
                ['Period', summary.label],
                ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ')],
                [],
                ['SUMMARY', 'Count', 'Amount (MYR)'],
                ['Quotations issued', summary.quotationCount, money(summary.quotationValue)],
                ['Invoices issued', summary.invoiceCount, ''],
                ['Invoices paid', summary.invoicePaidCount, money(summary.revenueCollected)],
                ['Invoices outstanding', summary.invoiceCount - summary.invoicePaidCount, money(summary.revenueOutstanding)],
                ['Payslips paid', summary.payslipCount, money(summary.payrollNet)],
                ['Claims approved', summary.claimCount, money(summary.claimApprovedTotal)],
                ['Vouchers approved', summary.voucherCount, money(summary.voucherApprovedTotal)],
                [],
                ['INVOICES & QUOTATIONS', 'Type', 'Date', 'Client', 'Status', 'Amount (MYR)'],
                ...docs.map(d => [d.docNo || '', d.type || '', d.date || '', d.name || '', d.status || '', money(d.amount)]),
                [],
                ['PAYROLL', 'Date', 'Employee', 'Net Pay (MYR)'],
                ...payslips.map(p => [p.docNo || '', p.date || '', p.name || '', money(p.amount)]),
                [],
                ['CLAIMS & VOUCHERS', 'Type', 'Date', 'Claimant', 'Status', 'Amount (MYR)'],
                ...claims.map(c => [c.receiptNo || c.voucherNo || '', c.documentType || c.type || '', this.claimDateOf(c), c.name || '', c.status || '', money(c.amount)])
            ];
            this.downloadCSV(rows, `Penyata_Bulanan_ZENQOR_${period}.csv`);
            this.logAudit('EXPORT', `Exported monthly statement for ${summary.label}`);
            this.showNotify(`${summary.label} statement downloaded.`);
        },
        // Shared by every CSV export so quoting, the BOM and the download path
        // stay consistent. A Blob rather than a data: URI - encodeURI() throws on
        // a lone % and silently mangles #, both of which appear in client names.
        downloadCSV(rows, filename) {
            const NEWLINE = String.fromCharCode(10);
            const BOM = String.fromCharCode(0xFEFF);
            const body = rows.map(row => (row || []).map(cell => this.csvSafeCell(cell)).join(',')).join(NEWLINE);
            const blob = new Blob([BOM + body], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        csvSafeCell(value) {
            let str = String(value);
            if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
            return `"${str.replace(/"/g, '""')}"`;
        },
        // `period` is a YYYY-MM key, or '' for every record. Defaults to whatever
        // scope the Reports tab is showing so the file matches the figures on screen.
        exportCSV(type, period = this.reportPeriod) {
            let filename = '';
            let rows = [];
            const todayStr = new Date().toISOString().slice(0, 10);
            // Employees is a directory, not a ledger — it has no period to slice by.
            const scope = type === 'employees' ? '' : period;
            const { docs, payslips, claims } = this.recordsForPeriod(scope);
            const suffix = scope ? scope : todayStr;

            if (type === 'payroll') {
                filename = `Laporan_Payroll_ZENQOR_${suffix}.csv`;
                rows = [['Payslip No', 'Tarikh Bayaran', 'Nama Pekerja', 'Gaji Bersih (MYR)'], ...payslips.map(p => [p.docNo || '', p.date || '', p.name || '', Number(p.amount || 0).toFixed(2)])];
            } else if (type === 'employees') {
                filename = `Direktori_Pekerja_ZENQOR_${suffix}.csv`;
                rows = [['ID Pekerja', 'Nama Lengkap', 'Jawatan', 'Jabatan', 'Status', 'Gaji Asas (MYR)'], ...this.employees.map(e => [e.empNo || '', e.name || '', e.position || '', e.dept || '', e.status || 'Aktif', Number(e.basicSalary || 0).toFixed(2)])];
            } else if (type === 'docs') {
                filename = `Laporan_Invois_SebutHarga_ZENQOR_${suffix}.csv`;
                rows = [['No Dokumen', 'Jenis', 'Tarikh Issue', 'Nama Pelanggan', 'Status', 'Jumlah (MYR)'], ...docs.map(d => [d.docNo || '', d.type || '', d.date || '', d.name || '', d.status || '', Number(d.amount || 0).toFixed(2)])];
            } else if (type === 'claims') {
                filename = `Laporan_Claims_Vouchers_ZENQOR_${suffix}.csv`;
                rows = [
                    ['No Rujukan', 'Jenis', 'Tarikh', 'Nama Pemohon', 'No Pekerja', 'Jabatan', 'Kategori', 'Status', 'Jumlah (MYR)'],
                    ...claims.map(c => [
                        c.receiptNo || c.voucherNo || '', c.documentType || c.type || '', c.date || c.expenseDate || c.paymentDate || '',
                        c.name || '', c.empNo || '', c.dept || '', c.category || '', c.status || '', Number(c.amount || 0).toFixed(2)
                    ])
                ];
            } else if (type === 'attendance') {
                filename = `Laporan_Kehadiran_ZENQOR_${suffix}.csv`;
                const { rows: summaryRows, totals } = this.attendanceSummaryForPeriod(scope);
                rows = [
                    ['No Pekerja', 'Nama', 'Hari Hadir', 'Jam Bekerja', 'Lewat', 'Tidak Hadir'],
                    ...summaryRows.map(r => [r.empNo, r.name, r.daysPresent, r.hoursWorked.toFixed(1), r.lateCount, r.absentCount]),
                    [],
                    ['JUMLAH', '', totals.daysPresent, totals.hoursWorked.toFixed(1), totals.lateCount, totals.absentCount]
                ];
            }

            if (rows.length === 0) { this.showNotify("Tiada rekod data untuk dieksport."); return; }

            this.downloadCSV(rows, filename);
            
            const scopeLabel = scope ? this.periodLabel(scope) : 'all periods';
            this.logAudit('EXPORT', `Mengeksport fail CSV bagi modul: ${type.toUpperCase()} (${scopeLabel})`);
            this.showNotify(`Laporan CSV (${type} — ${scopeLabel}) berjaya dimuat turun.`);
        },
        exportComplianceReport() {
            const todayStr = new Date().toISOString().slice(0, 10);
            const filename = `Compliance_Audit_Report_ZENQOR_${todayStr}.csv`;
            const rows = [
                ['ZENQOR HRMS/CDTS - PDPA Compliance & Security Audit Report'],
                [`Generated: ${new Date().toLocaleString('en-US')}`],
                [`Generated By: ${this.userProfile.name} (${this.userProfile.email})`],
                [`Total Logged Events: ${this.auditLogs.length}`],
                [],
                ['Timestamp (ISO)', 'User Name', 'User Email', 'UID', 'Role', 'Action', 'Module', 'Activity / Target', 'IP Address', 'Browser', 'Operating System', 'Device', 'Full User Agent'],
                ...this.auditLogs.map(log => [
                    log.timestamp || '', log.userName || '', log.user || '', log.uid || '', log.role || '',
                    log.action || '', log.module || '', log.details || '', log.ip || 'Unavailable',
                    log.browser || '', log.os || '', log.device || '', log.userAgent || log.browser || ''
                ])
            ];
            const csvContent = "data:text/csv;charset=utf-8,﻿" + rows.map(row => row.map(cell => this.csvSafeCell(cell)).join(",")).join("\n");
            const link = document.createElement("a");
            link.setAttribute("href", encodeURI(csvContent));
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.logAudit('EXPORT', 'Exported PDPA compliance & security audit report.');
            this.showNotify('Compliance report downloaded.');
        }
};