const STORAGE_KEY = 'se-sitrep-data';

const DEFAULT_MEMBERS = [
    { id: '1', name: 'Alex Chen', role: 'Lead Engineer', type: 'human', avatar: 'AC' },
    { id: '2', name: 'Sarah Miller', role: 'Frontend Dev', type: 'human', avatar: 'SM' },
    { id: '3', name: 'James Wilson', role: 'Backend Dev', type: 'human', avatar: 'JW' },
    { id: 'agent-alpha', name: 'Alpha-01', role: 'CI/CD Autopilot', type: 'agent', avatar: 'α' },
    { id: 'agent-beta', name: 'Beta-Scan', role: 'Security Sentinel', type: 'agent', avatar: 'β' }
];

const INITIAL_REPORTS = [
    {
        id: 'r1',
        memberId: '1',
        status: 'Overseeing deployment pipeline and reviewing PRs.',
        blockers: '',
        sentiment: 4,
        coverage: false,
        availability: 'Free for sync at 2pm',
        timestamp: new Date().toISOString()
    },
    {
        id: 'r2',
        memberId: 'agent-alpha',
        status: 'Optimizing build artifacts. 14 successful deployments today.',
        blockers: '',
        sentiment: 5,
        coverage: false,
        availability: '24/7',
        timestamp: new Date().toISOString()
    }
];

export const store = {
    state: {
        members: [...DEFAULT_MEMBERS],
        reports: [],
        agents: [
            { id: 'agent-alpha', name: 'Alpha-01', status: 'ACTIVE', load: 45, task: 'Analyzing Logs' },
            { id: 'agent-beta', name: 'Beta-Scan', status: 'IDLE', load: 12, task: 'Scanning for vulnerabilities' }
        ]
    },

    init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            this.state.reports = parsed.reports || [];
            // Preserve default members but could allow adding more later
        } else {
            this.state.reports = [...INITIAL_REPORTS];
            this.save();
        }
    },

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            reports: this.state.reports
        }));
    },

    addReport(report) {
        const newReport = {
            ...report,
            id: 'r-' + Date.now(),
            timestamp: new Date().toISOString()
        };
        this.state.reports.unshift(newReport);
        this.save();
        return newReport;
    },

    getReports() {
        return this.state.reports;
    },

    getMembers() {
        return this.state.members;
    },

    getMember(id) {
        return this.state.members.find(m => m.id === id);
    },

    getAgents() {
        return this.state.agents;
    },

    updateAgent(id, updates) {
        const agent = this.state.agents.find(a => a.id === id);
        if (agent) {
            Object.assign(agent, updates);
        }
    }
};
