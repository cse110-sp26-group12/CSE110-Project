import { store } from './store.js';
import { ui } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize store
    store.init();
    
    // Initialize UI
    ui.init();

    // Event Listeners
    setupEventListeners();

    // Simulation: Randomly update agent loads for "liveness"
    startAgentSimulation();
});

function setupEventListeners() {
    // Navigation
    ui.elements.navButtons.dashboard.addEventListener('click', () => ui.switchView('dashboard'));
    ui.elements.navButtons.roster.addEventListener('click', () => ui.switchView('roster'));
    ui.elements.navButtons.warroom.addEventListener('click', () => ui.switchView('warroom'));
    ui.elements.navButtons.checkin.addEventListener('click', () => ui.switchView('checkin'));

    // Form submission
    const form = document.getElementById('sitrep-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const reportData = {
            memberId: document.getElementById('member-select').value,
            status: document.getElementById('status-input').value,
            blockers: document.getElementById('blockers-input').value,
            sentiment: document.getElementById('sentiment-input').value,
            coverage: document.getElementById('coverage-input').checked,
            availability: document.getElementById('availability-input').value
        };

        store.addReport(reportData);
        form.reset();
        
        ui.renderAll();
        ui.switchView('dashboard');
        
        // Success feedback
        console.log('SitRep Transmitted Successfully.');
    });

    const cancelBtn = document.getElementById('cancel-checkin');
    cancelBtn.addEventListener('click', () => {
        form.reset();
        ui.switchView('dashboard');
    });
}

function startAgentSimulation() {
    setInterval(() => {
        const agents = store.getAgents();
        agents.forEach(agent => {
            // Random fluctuations in load
            const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
            let newLoad = agent.load + change;
            newLoad = Math.max(5, Math.min(95, newLoad));
            
            store.updateAgent(agent.id, { load: newLoad });
        });
        ui.renderAgents();
        ui.renderStats();
    }, 3000);
}
