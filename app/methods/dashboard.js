// The dashboard charts and the data behind them.
import {
    doc
} from "../../firebase-config.js";
export const dashboardMethods = {
        refreshDashboardCharts(attempt = 0) {
            if (!this.isLoggedIn || !this.portalDataReady || this.currentTab !== 'dashboard' || ['Staff', 'Client'].includes(this.userProfile.role)) return;
            if (this.chartRenderTimer) { clearTimeout(this.chartRenderTimer); this.chartRenderTimer = null; }
            if (this.chartRenderFrameOne) cancelAnimationFrame(this.chartRenderFrameOne);
            if (this.chartRenderFrameTwo) cancelAnimationFrame(this.chartRenderFrameTwo);
            this.chartRenderFrameOne = null;
            this.chartRenderFrameTwo = null;
            this.chartRenderAttempts = attempt;
            this.$nextTick(() => {
                if (!this.isLoggedIn || this.currentTab !== 'dashboard') return;
                this.chartRenderFrameOne = requestAnimationFrame(() => {
                    this.chartRenderFrameOne = null;
                    this.chartRenderFrameTwo = requestAnimationFrame(() => {
                        this.chartRenderFrameTwo = null;
                        if (!this.isLoggedIn || !this.portalDataReady || this.currentTab !== 'dashboard') return;
                        const revenueCanvas = document.getElementById('revenueChart');
                        const statusCanvas = document.getElementById('statusChart');
                        const claimsCanvas = document.getElementById('claimsChart');
                        if (typeof Chart === 'undefined' || !revenueCanvas?.isConnected || !statusCanvas?.isConnected || !claimsCanvas?.isConnected) {
                            if (attempt < 150) this.chartRenderTimer = setTimeout(() => this.refreshDashboardCharts(attempt + 1), 200);
                            return;
                        }
                        this.chartRenderAttempts = 0;
                        this.renderCharts();
                    });
                });
            });
        },
        destroyDashboardCharts() {
            if (this.chartRenderTimer) clearTimeout(this.chartRenderTimer);
            if (this.chartRenderFrameOne) cancelAnimationFrame(this.chartRenderFrameOne);
            if (this.chartRenderFrameTwo) cancelAnimationFrame(this.chartRenderFrameTwo);
            this.chartRenderTimer = null;
            this.chartRenderFrameOne = null;
            this.chartRenderFrameTwo = null;
            this.chartRenderAttempts = 0;
            if (this.revenueChartInstance) { try { this.revenueChartInstance.destroy(); } catch (error) { console.warn('Revenue chart cleanup skipped:', error); } }
            if (this.statusChartInstance) { try { this.statusChartInstance.destroy(); } catch (error) { console.warn('Status chart cleanup skipped:', error); } }
            if (this.claimsChartInstance) { try { this.claimsChartInstance.destroy(); } catch (error) { console.warn('Claims chart cleanup skipped:', error); } }
            this.revenueChartInstance = null;
            this.statusChartInstance = null;
            this.claimsChartInstance = null;
        },
        setChartFilter(timeframe) {
            this.chartTimeFilter = timeframe; this.refreshDashboardCharts();
            this.showNotify(`Chart view changed to: ${timeframe.toUpperCase()}`);
        },

        renderCharts() {
            if (typeof Chart === 'undefined' || !this.portalDataReady || this.currentTab !== 'dashboard' || ['Staff', 'Client'].includes(this.userProfile.role)) return;
            const revCanvas = document.getElementById('revenueChart');
            const statusCanvas = document.getElementById('statusChart');
            const claimsCanvas = document.getElementById('claimsChart');
            if (!revCanvas?.isConnected || !statusCanvas?.isConnected || !claimsCanvas?.isConnected) { this.refreshDashboardCharts(this.chartRenderAttempts + 1); return; }
            const ctxRev = revCanvas.getContext('2d');
            const ctxStatus = statusCanvas.getContext('2d');
            const ctxClaims = claimsCanvas.getContext('2d');
            if (!ctxRev || !ctxStatus || !ctxClaims) return;

            try {
                const gridColor = 'rgba(0,0,0,0.06)';
                const textColor = '#475569';
                const oldRevenueChart = Chart.getChart ? Chart.getChart(revCanvas) : this.revenueChartInstance;
                const oldStatusChart = Chart.getChart ? Chart.getChart(statusCanvas) : this.statusChartInstance;
                const oldClaimsChart = Chart.getChart ? Chart.getChart(claimsCanvas) : this.claimsChartInstance;
                if (oldRevenueChart) oldRevenueChart.destroy();
                if (oldStatusChart) oldStatusChart.destroy();
                if (oldClaimsChart) oldClaimsChart.destroy();

                const revData = this.getFilteredRevenueData();
                const revenueChart = new Chart(ctxRev, {
                    type: 'line', data: { labels: revData.labels, datasets: [{ label: 'Revenue Paid (RM)', data: revData.data, borderColor: '#0F766E', backgroundColor: 'rgba(15, 118, 110, 0.15)', borderWidth: 3, fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#E76F51' }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { beginAtZero: true, min: 0, grid: { color: gridColor }, ticks: { color: textColor, callback: function(value) { return 'RM ' + value.toLocaleString(); } } } }, plugins: { legend: { labels: { color: textColor } } } }
                });

                const statusValues = [this.paidInvoicesCount, this.unpaidInvoicesCount, this.totalQuotations];
                const hasStatusData = statusValues.some(value => value > 0);
                const statusChart = new Chart(ctxStatus, {
                    type: 'doughnut', data: { labels: hasStatusData ? ['Paid Invoices', 'Unpaid Invoices', 'Quotations'] : ['No document data yet'], datasets: [{ data: hasStatusData ? statusValues : [1], backgroundColor: hasStatusData ? ['#0F766E', '#E76F51', '#F4A261'] : ['#CBD5E1'], borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
                });

                const claimsStages = this.claimsPipelineStats;
                const hasClaimsData = claimsStages.some(stage => stage.count > 0);
                const claimsChart = new Chart(ctxClaims, {
                    type: 'bar',
                    data: {
                        labels: ['Pipeline'],
                        datasets: hasClaimsData
                            ? claimsStages.filter(stage => stage.count > 0).map(stage => ({ label: stage.label, data: [stage.count], backgroundColor: stage.color, stack: 'total', barThickness: 26, borderRadius: 5, borderSkipped: false, borderWidth: 2, borderColor: '#ffffff' }))
                            : [{ label: 'No claims data yet', data: [1], backgroundColor: '#E2E8F0', stack: 'total', barThickness: 26, borderRadius: 5 }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
                        layout: { padding: 0 },
                        scales: {
                            x: { display: false, stacked: true, grid: { display: false } },
                            y: { display: false, stacked: true, grid: { display: false } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: hasClaimsData, callbacks: { label: item => ` ${item.dataset.label}: ${item.raw} record(s)` } }
                        }
                    }
                });

                this.revenueChartInstance = Vue.markRaw ? Vue.markRaw(revenueChart) : revenueChart;
                this.statusChartInstance = Vue.markRaw ? Vue.markRaw(statusChart) : statusChart;
                this.claimsChartInstance = Vue.markRaw ? Vue.markRaw(claimsChart) : claimsChart;
            } catch (error) {
                console.error('Dashboard chart rendering failed:', error);
                if (this.chartRenderAttempts < 150) this.chartRenderTimer = setTimeout(() => this.refreshDashboardCharts(this.chartRenderAttempts + 1), 200);
            }
        },

        getFilteredRevenueData() {
            const filter = this.chartTimeFilter; const now = new Date(); let labels = []; let revenueData = [];
            if (filter === 'daily') {
                for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const dateStr = d.toISOString().substr(0, 10); labels.push(d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date === dateStr) total += (Number(doc.amount) || 0); }); revenueData.push(total); }
            } else if (filter === 'weekly') {
                for (let i = 3; i >= 0; i--) { labels.push(`Week ${4 - i}`); const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - (i * 7 + 7)); const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - (i * 7)); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (docDate >= weekStart && docDate <= weekEnd) total += (Number(doc.amount) || 0); } }); revenueData.push(total); }
            } else if (filter === 'monthly') {
                labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; revenueData = new Array(12).fill(0);
                this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (!isNaN(docDate.getTime()) && docDate.getFullYear() === now.getFullYear()) revenueData[docDate.getMonth()] += (Number(doc.amount) || 0); } });
            } else if (filter === 'yearly') {
                const currentYear = now.getFullYear(); for (let y = currentYear - 4; y <= currentYear; y++) { labels.push(String(y)); let total = 0; this.docHistory.forEach(doc => { if (doc.type === 'Invoice' && doc.status === 'Paid' && doc.date) { const docDate = new Date(doc.date); if (docDate.getFullYear() === y) total += (Number(doc.amount) || 0); } }); revenueData.push(total); }
            }
            return { labels, data: revenueData };
        }
};