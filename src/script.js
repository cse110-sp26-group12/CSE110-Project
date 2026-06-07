/**
 * Main frontend script for the SitRep application.
 *
 * This file handles:
 * - Navigation between different panels
 * - Theme switching
 * - Daily standup submission and display
 * - Team member management
 * - Task creation and completion
 * - Blocker creation and resolution
 * - Loading existing standup entries from the backend
 */

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Base URL for the SitRep backend API.
 * @constant {string}
 */
const API = 'https://sitrep-q52s.onrender.com';
/**
 * Represents a daily standup entry.
 *
 * @typedef {Object} Standup
 * @property {string} name - Name of the team member.
 * @property {string} done - Work completed yesterday.
 * @property {string} todo - Work planned for today.
 * @property {string} blockers - Any blockers reported by the team member.
 * @property {string} [submittedAt] - ISO timestamp showing when the standup was submitted.
 */
/**
 * Escapes special HTML characters in a string to prevent unsafe HTML injection.
 *
 * @param {string} str - The raw string entered by the user.
 * @returns {string} The escaped string that is safe to insert into HTML.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Creates a standup object using form input values.
 *
 * @param {string} name - Name of the team member.
 * @param {string} done - Work completed yesterday.
 * @param {string} todo - Work planned for today.
 * @param {string} blockers - Any blockers or issues.
 * @returns {Standup} A new standup object with a submission timestamp.
 */
function createStandup(name, done, todo, blockers) {
  return { name, done, todo, blockers, submittedAt: new Date().toISOString() };
}

// ── Tab switching ──────────────────────────────────────────────────────

document.querySelectorAll('.nav-links a[data-page]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');

    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-' + page).classList.remove('hidden');

    window.scrollTo(0, 0);
  });
});

// ── Theme toggle ───────────────────────────────────────────────────────

const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
});

// ── Daily StandUp ──────────────────────────────────────────────────────

const submitBtn      = document.getElementById('submitStandup');
const standupList    = document.getElementById('standupList');
const emptyState     = document.getElementById('emptyState');
const submittedCount = document.getElementById('submittedCount');
const blockerCountEl = document.getElementById('blockerCount');
const progressCount  = document.getElementById('progressCount');

let totalSubmissions = 0;
let totalBlockers    = 0;
let totalInProgress  = 0;

/**
 * Handles the Daily StandUp form submission.
 *
 * This function:
 * - Reads user input from the form
 * - Validates required fields
 * - Sends the standup data to the backend
 * - Creates a new standup card in the UI
 * - Updates dashboard counters
 * - Clears the form after successful submission
 *
 * @async
 * @returns {Promise<void>}
 */
submitBtn.addEventListener('click', async () => {
  const name      = document.getElementById('su-name').value.trim();
  const status    = document.getElementById('su-status').value;
  const yesterday = document.getElementById('su-yesterday').value.trim();
  const today     = document.getElementById('su-today').value.trim();
  const blockers  = document.getElementById('su-blockers').value.trim();

  if (!name || !yesterday || !today) {
    alert("Please fill out your name, yesterday's work, and today's plan.");
    return;
  }
  // ── Data Sync: Save New Entry to Database ─────────────────────────────
  try {
    const res = await fetch(`${API}/api/standups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, done: yesterday, todo: today, blockers }),
    });

  const standup = await res.json();
  emptyState.style.display = 'none';

  let statusClass = 'done';
  if (status === 'In progress') { statusClass = 'progress'; totalInProgress++; }
  else if (status === 'Blocked') { statusClass = 'blocker'; }

  if (standup.blockers) totalBlockers++;
  totalSubmissions++;

  const card = document.createElement('article');
  card.classList.add('standup-card');
  card.innerHTML = `
    <div class="standup-header">
      <div>
        <h3 class="person">${escapeHtml(standup.name)}</h3>
        <p class="role">Team Member</p>
      </div>
      <span class="status ${statusClass}">${escapeHtml(status)}</span>
    </div>
    <div class="standup-section">
      <strong>Yesterday</strong>
      <p>${escapeHtml(standup.done)}</p>
    </div>
    <div class="standup-section">
      <strong>Today</strong>
      <p>${escapeHtml(standup.todo)}</p>
    </div>
    <div class="standup-section">
      <strong>Blockers</strong>
      <p>${standup.blockers ? escapeHtml(standup.blockers) : 'No blockers reported.'}</p>
    </div>
  `;
  standupList.prepend(card);

  submittedCount.textContent = totalSubmissions;
  blockerCountEl.textContent = totalBlockers;
  progressCount.textContent  = totalInProgress;

  document.getElementById('su-name').value      = '';
  document.getElementById('su-status').value    = 'On track';
  document.getElementById('su-yesterday').value = '';
  document.getElementById('su-today').value     = '';
  document.getElementById('su-blockers').value  = '';
  } catch (error) {
    console.error("Failed to save standup to the backend:", error);
    alert("Could not save standup. Is the backend server waking up?");
  }
});

// ── Team Board ─────────────────────────────────────────────────────────

const addMemberBtn     = document.getElementById('addMemberBtn');
const addMemberForm    = document.getElementById('addMemberForm');
const memberNameInput  = document.getElementById('memberNameInput');
const confirmAddMember = document.getElementById('confirmAddMember');
const memberList       = document.getElementById('memberList');
const memberEmpty      = document.getElementById('memberEmpty');

addMemberBtn.addEventListener('click', () => {
  addMemberForm.classList.toggle('hidden');
  if (!addMemberForm.classList.contains('hidden')) memberNameInput.focus();
});

/**
 * Adds a new team member to the Team Board.
 *
 * The function reads the member name from the input field,
 * creates a new member card, adds a remove button, and updates
 * the empty-state message.
 *
 * @returns {void}
 */
function addMember() {
  const name = memberNameInput.value.trim();
  if (!name) return;

  const item = document.createElement('div');
  item.classList.add('member-item');
  item.innerHTML = `
    <div class="member-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
    <div class="member-info">
      <strong>${escapeHtml(name)}</strong>
      <span>Team Member</span>
    </div>
    <button class="remove-btn" aria-label="Remove member">&times;</button>
  `;
  item.querySelector('.remove-btn').addEventListener('click', () => {
    item.remove();
    if (memberList.children.length === 0) memberEmpty.style.display = '';
  });

  memberList.appendChild(item);
  memberEmpty.style.display = 'none';
  memberNameInput.value = '';
  addMemberForm.classList.add('hidden');
}

confirmAddMember.addEventListener('click', addMember);
memberNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

// ── Tasks ──────────────────────────────────────────────────────────────

const createTaskBtn      = document.getElementById('createTaskBtn');
const createTaskForm     = document.getElementById('createTaskForm');
const taskNameInput      = document.getElementById('taskNameInput');
const confirmCreateTask  = document.getElementById('confirmCreateTask');
const taskList           = document.getElementById('taskList');
const taskEmpty          = document.getElementById('taskEmpty');
const completedTaskList  = document.getElementById('completedTaskList');
const completedTaskEmpty = document.getElementById('completedTaskEmpty');

let taskCount = 0;

createTaskBtn.addEventListener('click', () => {
  createTaskForm.classList.toggle('hidden');
  if (!createTaskForm.classList.contains('hidden')) taskNameInput.focus();
});

/**
 * Creates a new task item and adds it to the active task list.
 *
 * When the checkbox is selected, the task is moved from the active
 * task list to the completed task list.
 *
 * @returns {void}
 */
function createTask() {
  const name = taskNameInput.value.trim();
  if (!name) return;

  taskCount++;
  const id = 'task-' + taskCount;

  const item = document.createElement('div');
  item.classList.add('check-item');
  // label first → text on left; input last → checkbox on right
  item.innerHTML = `
    <label for="${id}">${escapeHtml(name)}</label>
    <input type="checkbox" id="${id}" />
  `;
  item.querySelector('input').addEventListener('change', () => {
    item.remove();
    if (taskList.children.length === 0) taskEmpty.style.display = '';

    const done = document.createElement('div');
    done.classList.add('check-item');
    done.innerHTML = `<span class="completed-text">${escapeHtml(name)}</span>`;
    completedTaskList.appendChild(done);
    completedTaskEmpty.style.display = 'none';
  });

  taskList.appendChild(item);
  taskEmpty.style.display = 'none';
  taskNameInput.value = '';
  createTaskForm.classList.add('hidden');
}

confirmCreateTask.addEventListener('click', createTask);
taskNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') createTask(); });

// ── Blockers ───────────────────────────────────────────────────────────

const createBlockerBtn     = document.getElementById('createBlockerBtn');
const createBlockerForm    = document.getElementById('createBlockerForm');
const blockerDescInput     = document.getElementById('blockerDescInput');
const confirmCreateBlocker = document.getElementById('confirmCreateBlocker');
const blockerItemList      = document.getElementById('blockerItemList');
const blockerItemEmpty     = document.getElementById('blockerItemEmpty');
const resolvedBlockerList  = document.getElementById('resolvedBlockerList');
const resolvedBlockerEmpty = document.getElementById('resolvedBlockerEmpty');

let blockerItemCount = 0;

createBlockerBtn.addEventListener('click', () => {
  createBlockerForm.classList.toggle('hidden');
  if (!createBlockerForm.classList.contains('hidden')) blockerDescInput.focus();
});


/**
 * Creates a new blocker item and adds it to the active blocker list.
 *
 * When the checkbox is selected, the blocker is moved from the active
 * blocker list to the resolved blocker list.
 *
 * @returns {void}
 */
function createBlockerItem() {
  const desc = blockerDescInput.value.trim();
  if (!desc) return;

  blockerItemCount++;
  const id = 'blocker-' + blockerItemCount;

  const item = document.createElement('div');
  item.classList.add('check-item');
  // label first → text on left; input last → checkbox on right
  item.innerHTML = `
    <label for="${id}">${escapeHtml(desc)}</label>
    <input type="checkbox" id="${id}" />
  `;
  item.querySelector('input').addEventListener('change', () => {
    item.remove();
    if (blockerItemList.children.length === 0) blockerItemEmpty.style.display = '';

    const resolved = document.createElement('div');
    resolved.classList.add('check-item');
    resolved.innerHTML = `<span class="completed-text">${escapeHtml(desc)}</span>`;
    resolvedBlockerList.appendChild(resolved);
    resolvedBlockerEmpty.style.display = 'none';
  });

  blockerItemList.appendChild(item);
  blockerItemEmpty.style.display = 'none';
  blockerDescInput.value = '';
  createBlockerForm.classList.add('hidden');
}

confirmCreateBlocker.addEventListener('click', createBlockerItem);
blockerDescInput.addEventListener('keydown', e => { if (e.key === 'Enter') createBlockerItem(); });
//── Data Sync: Load Existing Entries ───────────────────────────────────
/**
 * Loads existing standup entries from the backend database.
 *
 * This function sends a GET request to the standup API, renders each
 * returned standup as a card, and updates the dashboard counters based
 * on the loaded data.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadExistingStandups() {
  try {
    // 1. Fetch the data from the server (Defaults to a GET request)
    const res = await fetch(`${API}/api/standups`);
    const standups = await res.json(); 

    if (standups.length > 0) {
      emptyState.style.display = 'none';
    }

    // 2. Loop through the historical data and append cards to the UI
    standups.reverse().forEach(standup => {
      let statusClass = 'done';
      let statusText = 'On track';
      
      if (standup.blockers) {
        statusClass = 'blocker';
        statusText = 'Blocked';
        totalBlockers++;
      }
      
      totalSubmissions++;

      const card = document.createElement('article');
      card.classList.add('standup-card');
      card.innerHTML = `
        <div class="standup-header">
          <div>
            <h3 class="person">${escapeHtml(standup.name)}</h3>
            <p class="role">Team Member</p>
          </div>
          <span class="status ${statusClass}">${statusText}</span>
        </div>
        <div class="standup-section">
          <strong>Yesterday</strong>
          <p>${escapeHtml(standup.done)}</p>
        </div>
        <div class="standup-section">
          <strong>Today</strong>
          <p>${escapeHtml(standup.todo)}</p>
        </div>
        <div class="standup-section">
          <strong>Blockers</strong>
          <p>${standup.blockers ? escapeHtml(standup.blockers) : 'No blockers reported.'}</p>
        </div>
      `;
      standupList.prepend(card);
    });

    // 3. Keep dashboard metric counters accurate on load
    submittedCount.textContent = totalSubmissions;
    blockerCountEl.textContent = totalBlockers;
    progressCount.textContent  = totalInProgress;

  } catch (error) {
    console.error("Failed to load historical standups:", error);
  }
}

// Automatically kick off the fetch request when the browser finishes loading
loadExistingStandups();
