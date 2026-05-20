const app = {
    state: {
        users: [],
        projects: [],
        currentProjectId: null,
        currentUser: null,
        invitations: [] // Global invitations list for the prototype
    },

    priorityMap: { high: 3, medium: 2, low: 1 },

    init() {
        const savedState = localStorage.getItem('agileState');
        if (savedState) {
            this.state = JSON.parse(savedState);
            // Ensure necessary arrays exist for older saved states
            if (!this.state.users) this.state.users = [];
            if (!this.state.invitations) this.state.invitations = [];
        } else {
            // Initial setup if no state exists
            this.addProject(null, "Initial Sample Project");
        }
        this.render();
    },

    save() {
        localStorage.setItem('agileState', JSON.stringify(this.state));
    },

    get currentProject() {
        if (!this.state.currentUser) return null;
        return this.state.projects.find(p => p.id === this.state.currentProjectId && p.members.includes(this.state.currentUser));
    },

    get userProjects() {
        if (!this.state.currentUser) return [];
        return this.state.projects.filter(p => p.members.includes(this.state.currentUser));
    },

    get userInvitations() {
        if (!this.state.currentUser) return [];
        return this.state.invitations.filter(i => i.to === this.state.currentUser && i.status === 'pending');
    },

    // Auth Logic
    toggleAuthMode(mode) {
        const loginForm = document.getElementById('login-form-container');
        const signupForm = document.getElementById('signup-form-container');
        const loginError = document.getElementById('login-error');
        const signupError = document.getElementById('signup-error');

        if (loginError) loginError.style.display = 'none';
        if (signupError) signupError.style.display = 'none';

        if (mode === 'signup') {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        } else {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        }
    },

    login(e) {
        e.preventDefault();
        const name = document.getElementById('loginName').value.trim();
        const pass = document.getElementById('loginPass').value;
        const errorEl = document.getElementById('login-error');

        const user = this.state.users.find(u => u.name === name && u.password === pass);

        if (user) {
            this.state.currentUser = user.name;
            errorEl.style.display = 'none';
            document.getElementById('loginName').value = '';
            document.getElementById('loginPass').value = '';
            this.save();
            this.render();
        } else {
            errorEl.style.display = 'block';
        }
    },

    register(e) {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const pass = document.getElementById('signupPass').value;
        const errorEl = document.getElementById('signup-error');

        if (this.state.users.some(u => u.name === name)) {
            errorEl.style.display = 'block';
            return;
        }

        this.state.users.push({ name, password: pass });
        this.state.currentUser = name;
        errorEl.style.display = 'none';
        document.getElementById('signupName').value = '';
        document.getElementById('signupPass').value = '';
        this.save();
        this.render();
    },

    logout() {
        this.state.currentUser = null;
        this.save();
        this.render();
    },

    // Navigation
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
        
        const view = document.getElementById(`view-${viewId}`);
        const nav = document.getElementById(`nav-${viewId}`);
        if (view) view.classList.add('active');
        if (nav) nav.classList.add('active');
    },

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    },

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    },

    // Project Logic
    addProject(e, name) {
        if (e) e.preventDefault();
        const projectName = name || document.getElementById('projectName').value;
        const newProject = {
            id: Date.now().toString(),
            name: projectName,
            members: this.state.currentUser ? [this.state.currentUser] : ["Default Member"],
            tasks: [],
            standups: []
        };
        this.state.projects.push(newProject);
        this.state.currentProjectId = newProject.id;
        this.save();
        if (e) {
            this.hideModal('projectModal');
            e.target.reset();
        }
        this.render();
    },

    switchProject(id) {
        this.state.currentProjectId = id;
        this.save();
        this.render();
    },

    // Task Logic
    addTask(e) {
        e.preventDefault();
        const desc = document.getElementById('taskDesc').value;
        const priority = document.getElementById('taskPriority').value;
        
        this.currentProject.tasks.push({
            id: Date.now().toString(),
            desc,
            priority,
            status: 'active',
            createdAt: new Date().toISOString()
        });

        this.save();
        this.hideModal('taskModal');
        e.target.reset();
        this.render();
    },

    completeTask(taskId) {
        const task = this.currentProject.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            this.save();
            this.render();
        }
    },

    deleteTask(taskId) {
        this.currentProject.tasks = this.currentProject.tasks.filter(t => t.id !== taskId);
        this.save();
        this.render();
    },

    // Stand-up Logic
    addStandup(e) {
        e.preventDefault();
        const standup = {
            id: Date.now().toString(),
            member: document.getElementById('standupMember').value,
            prev: document.getElementById('standupPrev').value,
            planned: document.getElementById('standupPlanned').value,
            constraints: document.getElementById('standupConstraints').value,
            date: new Date().toLocaleDateString()
        };

        this.currentProject.standups.unshift(standup);
        this.save();
        this.hideModal('standupModal');
        e.target.reset();
        this.render();
    },

    // Member Logic
    inviteMember(e) {
        e.preventDefault();
        const name = document.getElementById('inviteName').value.trim();
        const errorEl = document.getElementById('invite-error');
        const successEl = document.getElementById('invite-success');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (name === this.state.currentUser) {
            errorEl.innerText = "You cannot invite yourself.";
            errorEl.style.display = 'block';
            return;
        }

        if (this.currentProject.members.includes(name)) {
            errorEl.innerText = "This user is already a member.";
            errorEl.style.display = 'block';
            return;
        }

        const userExists = this.state.users.some(u => u.name === name);
        if (!userExists) {
            errorEl.innerText = "User does not exist.";
            errorEl.style.display = 'block';
            return;
        }

        // Check for pending invitation
        const pending = this.state.invitations.some(i => i.to === name && i.projectId === this.currentProject.id && i.status === 'pending');
        if (pending) {
            errorEl.innerText = "An invitation is already pending.";
            errorEl.style.display = 'block';
            return;
        }

        this.state.invitations.push({
            id: Date.now().toString(),
            from: this.state.currentUser,
            to: name,
            projectId: this.currentProject.id,
            projectName: this.currentProject.name,
            status: 'pending'
        });

        successEl.innerText = `Invitation sent to ${name}!`;
        successEl.style.display = 'block';
        document.getElementById('inviteName').value = '';
        this.save();
        this.render();
    },

    acceptInvitation(invId) {
        const inv = this.state.invitations.find(i => i.id === invId);
        if (inv) {
            inv.status = 'accepted';
            const project = this.state.projects.find(p => p.id === inv.projectId);
            if (project && !project.members.includes(this.state.currentUser)) {
                project.members.push(this.state.currentUser);
            }
            this.save();
            this.render();
        }
    },

    rejectInvitation(invId) {
        const inv = this.state.invitations.find(i => i.id === invId);
        if (inv) {
            inv.status = 'rejected';
            this.save();
            this.render();
        }
    },

    // Rendering
    render() {
        const loginView = document.getElementById('view-login');
        if (!this.state.currentUser) {
            loginView.style.display = 'flex';
            this.toggleAuthMode('login'); 
            return;
        }
        loginView.style.display = 'none';

        this.renderSidebar();
        this.renderProjectSelect();
        this.renderInbox();

        if (!this.currentProject && this.userProjects.length > 0) {
            this.state.currentProjectId = this.userProjects[0].id;
        }

        if (this.currentProject) {
            this.renderProgress();
            this.renderTasks();
            this.renderStandups();
            this.renderMembers();
            this.renderHistory();
        } else {
            this.renderEmptyState();
        }
    },

    renderSidebar() {
        const userInfo = document.getElementById('sidebarUserInfo');
        const invCount = this.userInvitations.length;
        userInfo.innerHTML = `
            <strong>Logged in as:</strong>
            <span>${this.state.currentUser}</span>
            <button class="btn-danger" style="width: 100%; margin-top: 10px; padding: 5px;" onclick="app.logout()">Logout</button>
        `;

        // Update Inbox Nav with badge
        const inboxNav = document.getElementById('nav-inbox');
        if (inboxNav) {
            inboxNav.innerHTML = `<span>📥</span> Inbox ${invCount > 0 ? `<b style="background:var(--danger); color:white; padding:2px 6px; border-radius:10px; font-size:0.7rem;">${invCount}</b>` : ''}`;
        }
    },

    renderInbox() {
        const list = document.getElementById('inboxList');
        if (!list) return;
        const invs = this.userInvitations;

        list.innerHTML = invs.length ? invs.map(i => `
            <div class="task-card">
                <div class="task-info">
                    <h3>Invitation to ${i.projectName}</h3>
                    <p>From: <strong>${i.from}</strong></p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-success" onclick="app.acceptInvitation('${i.id}')">Accept</button>
                    <button class="btn-danger" onclick="app.rejectInvitation('${i.id}')">Reject</button>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; color: var(--gray);">Your inbox is empty.</p>';
    },

    renderProjectSelect() {
        const select = document.getElementById('projectSelect');
        const projects = this.userProjects;
        select.innerHTML = projects.map(p => 
            `<option value="${p.id}" ${p.id === this.state.currentProjectId ? 'selected' : ''}>${p.name}</option>`
        ).join('');
    },

    renderProgress() {
        const container = document.getElementById('taskProgressContainer');
        const tasks = this.currentProject.tasks;
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        container.innerHTML = `
            <div class="progress-container">
                <div class="progress-fill" style="width: ${percent}%"></div>
                <div class="progress-text">Project Progress: ${percent}% (${completed}/${total} Tasks)</div>
            </div>
        `;
    },

    renderTasks() {
        const list = document.getElementById('taskList');
        const activeTasks = this.currentProject.tasks
            .filter(t => t.status === 'active')
            .sort((a, b) => this.priorityMap[b.priority] - this.priorityMap[a.priority]);

        list.innerHTML = activeTasks.length ? activeTasks.map(t => `
            <div class="task-card priority-${t.priority}">
                <div class="task-info">
                    <h3>${t.desc}</h3>
                    <span class="badge badge-${t.priority}">${t.priority}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-success" onclick="app.completeTask('${t.id}')">✓</button>
                    <button class="btn-danger" onclick="app.deleteTask('${t.id}')">✕</button>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; color: var(--gray);">No active tasks. Add one to get started!</p>';
    },

    renderStandups() {
        const feed = document.getElementById('standupFeed');
        feed.innerHTML = this.currentProject.standups.length ? this.currentProject.standups.map(s => `
            <div class="standup-entry">
                <div class="standup-header">
                    <strong>${s.member}</strong>
                    <span>${s.date}</span>
                </div>
                <div class="standup-section">
                    <h4>Previously Completed</h4>
                    <p>${s.prev}</p>
                </div>
                <div class="standup-section">
                    <h4>Planned for Today</h4>
                    <p>${s.planned}</p>
                </div>
                ${s.constraints ? `
                <div class="standup-section">
                    <h4>Constraints / Blockers</h4>
                    <p>${s.constraints}</p>
                </div>` : ''}
            </div>
        `).join('') : '<p style="text-align: center; color: var(--gray);">No stand-up updates yet.</p>';

        const select = document.getElementById('standupMember');
        select.innerHTML = this.currentProject.members.map(m => 
            `<option value="${m}">${m}</option>`
        ).join('');
    },

    renderMembers() {
        const list = document.getElementById('memberList');
        list.innerHTML = this.currentProject.members.map(m => `
            <div class="member-card">
                <div class="member-avatar">${m.charAt(0).toUpperCase()}</div>
                <strong>${m}</strong>
            </div>
        `).join('');
    },

    renderHistory() {
        const list = document.getElementById('historyList');
        const completedTasks = this.currentProject.tasks
            .filter(t => t.status === 'completed')
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        list.innerHTML = completedTasks.length ? completedTasks.map(t => `
            <div class="task-card" style="opacity: 0.7; border-left-color: var(--gray);">
                <div class="task-info">
                    <h3 style="text-decoration: line-through;">${t.desc}</h3>
                    <span style="font-size: 0.8rem; color: var(--gray);">Completed on ${new Date(t.completedAt).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; color: var(--gray);">No completed tasks yet.</p>';
    },

    renderEmptyState() {
        const views = ['taskList', 'standupFeed', 'memberList', 'historyList'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.innerHTML = '<p style="text-align: center; color: var(--gray);">You are not a member of any projects. Create one to get started!</p>';
        });
        const progress = document.getElementById('taskProgressContainer');
        if (progress) progress.innerHTML = '';
    }
};

app.init();
