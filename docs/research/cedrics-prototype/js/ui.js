import { store } from './store.js';

export const ui = {
    elements: {
        systemTime: document.getElementById('system-time'),
        dashboardView: document.getElementById('dashboard-view'),
        rosterView: document.getElementById('roster-view'),
        warroomView: document.getElementById('warroom-view'),
        checkinView: document.getElementById('checkin-view'),
        reportsContainer: document.getElementById('reports-container'),
        agentPulseContainer: document.getElementById('agent-pulse-container'),
        rosterContainer: document.getElementById('roster-container'),
        availabilityMatrix: document.getElementById('availability-matrix'),
        memberSelect: document.getElementById('member-select'),
        navButtons: {
            dashboard: document.getElementById('nav-dashboard'),
            roster: document.getElementById('nav-roster'),
            warroom: document.getElementById('nav-warroom'),
            checkin: document.getElementById('nav-checkin')
        },
        stats: {
            active: document.getElementById('stat-active'),
            blocked: document.getElementById('stat-blocked'),
            mood: document.getElementById('stat-mood'),
            agents: document.getElementById('stat-agents')
        }
    },

    init() {
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        this.populateMemberSelect();
        this.renderAll();
    },

    updateTime() {
        const now = new Date();
        this.elements.systemTime.textContent = now.toISOString().split('T')[1].split('.')[0] + ' UTC';
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
        
        const view = document.getElementById(`${viewId}-view`);
        if (view) view.classList.add('active');

        const navBtn = this.elements.navButtons[viewId];
        if (navBtn) navBtn.classList.add('active');
    },

    populateMemberSelect() {
        const members = store.getMembers();
        this.elements.memberSelect.innerHTML = '<option value="">Select Member...</option>' + 
            members.map(m => `<option value="${m.id}">${m.name} (${m.type})</option>`).join('');
    },

    renderAll() {
        this.renderStats();
        this.renderReports();
        this.renderAgents();
        this.renderRoster();
        this.renderWarRoom();
    },

    renderStats() {
        const reports = store.getReports();
        const agents = store.getAgents();
        
        const blockedCount = reports.filter(r => r.blockers && r.blockers.trim() !== '').length;
        const totalMood = reports.reduce((acc, r) => acc + parseInt(r.sentiment), 0);
        const avgMood = reports.length ? (totalMood / reports.length).toFixed(1) : '0.0';
        const avgAgentLoad = agents.reduce((acc, a) => acc + a.load, 0) / agents.length;

        this.elements.stats.active.querySelector('.value').textContent = store.getMembers().length;
        this.elements.stats.blocked.querySelector('.value').textContent = blockedCount;
        this.elements.stats.mood.querySelector('.value').textContent = avgMood;
        this.elements.stats.agents.querySelector('.value').textContent = Math.round(avgAgentLoad) + '%';
    },

    renderReports() {
        const reports = store.getReports();
        this.elements.reportsContainer.innerHTML = reports.map(r => {
            const member = store.getMember(r.memberId);
            return `
                <div class="report-item">
                    <div class="report-meta">
                        <span class="report-author">${member ? member.name : 'Unknown'}</span>
                        <span class="report-time">${this.formatTimestamp(r.timestamp)}</span>
                    </div>
                    <div class="report-content">${r.status}</div>
                    ${r.blockers ? `<div class="report-blockers"><strong>BLOCKER:</strong> ${r.blockers}</div>` : ''}
                    ${r.coverage ? `<div class="report-blockers" style="border-color: var(--warning); background: rgba(245, 158, 11, 0.1);"><strong>COVERAGE REQUESTED</strong></div>` : ''}
                </div>
            `;
        }).join('');
    },

    renderAgents() {
        const agents = store.getAgents();
        this.elements.agentPulseContainer.innerHTML = agents.map(a => `
            <div class="agent-card">
                <div class="agent-header">
                    <span class="agent-name">${a.name}</span>
                    <span class="agent-status-tag" style="color: ${a.status === 'ACTIVE' ? 'var(--accent)' : 'var(--text-muted)'}">${a.status}</span>
                </div>
                <div class="agent-task" style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 0.5rem;">> PR_REVIEW_SUBTASK_${Math.floor(Math.random() * 1000)}</div>
                <div class="agent-task" style="font-size: 0.8rem; color: var(--text-main);">${a.task}</div>
                <div class="compute-bar">
                    <div class="compute-progress" style="width: ${a.load}%"></div>
                </div>
                <div class="compute-label" style="font-size: 0.7rem; text-align: right; margin-top: 0.2rem; font-family: var(--font-mono);">
                    VOLTAGE: NOMINAL | LOAD: ${a.load}%
                </div>
            </div>
        `).join('');
    },

    renderRoster() {
        const members = store.getMembers();
        const reports = store.getReports();

        this.elements.rosterContainer.innerHTML = members.map(m => {
            const lastReport = reports.find(r => r.memberId === m.id);
            const statusClass = lastReport ? (lastReport.blockers ? 'blocked' : 'operational') : 'offline';
            
            return `
                <div class="member-card">
                    <div class="member-status-indicator ${statusClass}"></div>
                    <div class="member-content">
                        <div class="member-header">
                            <div class="member-avatar">${m.avatar}</div>
                            <div class="member-info">
                                <h3>${m.name}</h3>
                                <div class="role">${m.role}</div>
                            </div>
                        </div>
                        <div class="member-current-task">
                            ${lastReport ? lastReport.status : 'No report submitted today.'}
                        </div>
                        <div class="member-stats">
                            <span>Mood: ${lastReport ? lastReport.sentiment : '-'}</span>
                            <span>${lastReport ? this.formatTimestamp(lastReport.timestamp) : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderWarRoom() {
        const reports = store.getReports();
        const members = store.getMembers();
        
        this.elements.availabilityMatrix.innerHTML = members.map(m => {
            const lastReport = reports.find(r => r.memberId === m.id);
            const availability = lastReport ? lastReport.availability : 'No data';
            return `
                <div class="availability-row" style="display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--border);">
                    <div class="member-info">
                        <strong>${m.name}</strong> (${m.type})
                    </div>
                    <div class="availability-status" style="color: var(--accent); font-family: var(--font-mono);">
                        ${availability}
                    </div>
                </div>
            `;
        }).join('');
    },

    formatTimestamp(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};
