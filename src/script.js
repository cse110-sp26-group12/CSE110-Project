// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Base URL for the SE SitRep API.
 * Resolves to the remote Render deployment when hosted on GitHub Pages,
 * or falls back to a relative path for local development.
 *
 * @constant {string}
 */
const API = location.hostname.endsWith('github.io')
  ? 'https://sitrep-q52s.onrender.com'
  : '';

/**
 * Escapes special HTML characters in a string to prevent XSS injection
 * when rendering user-submitted standup content into the DOM.
 *
 * @param {string} str - Raw user input to sanitize.
 * @returns {string} HTML-safe version of the input string.
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>');
 * // Returns '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Tab switching ──────────────────────────────────────────────────────

/**
 * Initialises SPA-style tab navigation for the SE SitRep dashboard panels
 * (e.g. Standup, Team Board, Tasks, Blockers).
 *
 * Attaches click listeners to every nav link with a `data-page` attribute.
 * On click, the matching panel is revealed, all others are hidden, and the
 * active nav link is highlighted.
 *
 * @listens click - On `.nav-links a[data-page]` elements.
 */
document.querySelectorAll('.nav-links a[data-page]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;

    document
      .querySelectorAll('.nav-links a')
      .forEach((a) => a.classList.remove('active'));
    link.classList.add('active');

    document
      .querySelectorAll('.panel')
      .forEach((p) => p.classList.add('hidden'));
    document.getElementById('panel-' + page).classList.remove('hidden');

    window.scrollTo(0, 0);
  });
});

// ── Theme toggle ───────────────────────────────────────────────────────

/**
 * The theme toggle button element.
 * Switches the dashboard between light and dark mode for accessibility
 * and developer preference.
 *
 * @type {HTMLButtonElement}
 */
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark')
    ? 'Light Mode'
    : 'Dark Mode';
});

// ── Daily StandUp ──────────────────────────────────────────────────────

/**
 * Button that triggers standup form submission.
 * @type {HTMLButtonElement}
 */
const submitBtn = document.getElementById('submitStandup');

/**
 * Container element where submitted standup cards are rendered.
 * @type {HTMLElement}
 */
const standupList = document.getElementById('standupList');

/**
 * Placeholder element shown when no standups have been submitted yet.
 * @type {HTMLElement}
 */
const emptyState = document.getElementById('emptyState');

/**
 * Displays the total number of standups submitted in the current session.
 * @type {HTMLElement}
 */
const submittedCount = document.getElementById('submittedCount');

/**
 * Displays the count of team members currently marked as Blocked.
 * @type {HTMLElement}
 */
const blockerCountEl = document.getElementById('blockerCount');

/**
 * Displays the count of team members currently marked as In Progress.
 * @type {HTMLElement}
 */
const progressCount = document.getElementById('progressCount');

/**
 * Running total of standup entries submitted during the session.
 * @type {number}
 */
let totalSubmissions = 0;

/**
 * Running total of standups flagged as Blocked.
 * Incremented whenever a standup includes a non-empty blocker field.
 * @type {number}
 */
let totalBlockers = 0;

/**
 * Running total of standups flagged as In Progress.
 * @type {number}
 */
let totalInProgress = 0;

/**
 * @typedef {Object} StandupPayload
 * @property {string} name       - The team member's name.
 * @property {string} done       - Work completed yesterday.
 * @property {string} todo       - Work planned for today.
 * @property {string} blockers   - Any impediments blocking progress. Use 'none' if unblocked.
 * @property {string} statusFlag - Agile status flag: 'On track' | 'In progress' | 'Blocked'.
 */
 
/**
 * @typedef {Object} StandupResponse
 * @property {string} name       - The team member's name as stored by the server.
 * @property {string} done       - Yesterday's completed work.
 * @property {string} todo       - Today's planned work.
 * @property {string} [blockers] - Reported blockers, if any.
 * @property {string} statusFlag - Server-resolved status: 'On track' | 'In progress' | 'Blocked'.
 */
 
/**
 * Handles the submission of a daily standup entry.
 *
 * Reads the standup form fields (name, status, yesterday, today, blockers),
 * applies SE SitRep's blocker-override logic (a standup with any blocker text
 * is always rendered as 'Blocked' regardless of the selected status flag),
 * POSTs the entry to the API, then prepends a new standup card to the feed
 * and updates the summary counters.
 *
 * @async
 * @listens click - On the `#submitStandup` button.
 * @throws {Error} Displays an alert if the API request fails or required fields are missing.
 */
submitBtn.addEventListener('click', async () => {
  const name = document.getElementById('su-name').value.trim();
  let internalStatus = document.getElementById('su-status').value;
  let displayedStatus = internalStatus;
  const yesterday = document.getElementById('su-yesterday').value.trim();
  const today = document.getElementById('su-today').value.trim();
  const blockers = document.getElementById('su-blockers').value.trim();

  if (internalStatus == 'Blocked') internalStatus = 'In progress'; //'Blocked' is an overlay over the internal status; actual blockage status is determined by the server

  if (!name || !yesterday || !today) {
    alert("Please fill out your name, yesterday's work, and today's plan.");
    return;
  }
  try {
    const res = await fetch(`${API}/api/standups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        done: yesterday,
        todo: today,
        blockers,
        statusFlag: internalStatus,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit standup');
    }

    const standup = await res.json();
    emptyState.style.display = 'none';

    let statusClass = 'done';
    if (standup.blockers && standup.blockers.toLowerCase() !== 'none') {
      //blocker truth overrides selected flag
      displayedStatus = 'Blocked';
      statusClass = 'blocker';
      totalBlockers++;
    } else if (
      displayedStatus === 'Blocked' ||
      displayedStatus === 'In progress'
    ) {
      //false blocker is also overridden (default to 'In progress')
      displayedStatus = 'In progress';
      statusClass = 'progress';
      totalInProgress++;
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
      <span class="status ${statusClass}">${escapeHtml(displayedStatus)}</span>
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
    progressCount.textContent = totalInProgress;

    document.getElementById('su-name').value = '';
    document.getElementById('su-status').value = 'On track';
    document.getElementById('su-yesterday').value = '';
    document.getElementById('su-today').value = '';
    document.getElementById('su-blockers').value = '';
  } catch (error) {
    console.error('Failed to save standup to the backend:', error);
    alert(
      error.message ||
        'Could not save standup. Is the backend server waking up?',
    );
  }
});

// ── Team Board ─────────────────────────────────────────────────────────

/**
 * Button that toggles the add-member input form on the Team Board panel.
 * @type {HTMLButtonElement}
 */
const addMemberBtn = document.getElementById('addMemberBtn');

/**
 * The collapsible form used to enter a new team member's name.
 * @type {HTMLElement}
 */
const addMemberForm = document.getElementById('addMemberForm');

/**
 * Text input for the new team member's name.
 * @type {HTMLInputElement}
 */
const memberNameInput = document.getElementById('memberNameInput');

/**
 * Confirm button that finalises adding a new team member.
 * @type {HTMLButtonElement}
 */
const confirmAddMember = document.getElementById('confirmAddMember');

/**
 * Container element that holds the rendered list of team member cards.
 * @type {HTMLElement}
 */
const memberList = document.getElementById('memberList');

/**
 * Placeholder element displayed when the Team Board has no members yet.
 * @type {HTMLElement}
 */
const memberEmpty = document.getElementById('memberEmpty');

addMemberBtn.addEventListener('click', () => {
  addMemberForm.classList.toggle('hidden');
  if (!addMemberForm.classList.contains('hidden')) memberNameInput.focus();
});

/**
 * Adds a new team member to the SE SitRep Team Board.
 *
 * Reads the name from `#memberNameInput`, creates a member card with an
 * avatar initial and a remove button, then appends it to the member list.
 * Clears and hides the form on completion.
 *
 * @returns {void} Returns early if the name input is empty.
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
memberNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addMember();
});

// ── Tasks ──────────────────────────────────────────────────────────────

/**
 * Button that toggles the create-task input form.
 * @type {HTMLButtonElement}
 */
const createTaskBtn = document.getElementById('createTaskBtn');

/**
 * The collapsible form used to enter a new task name.
 * @type {HTMLElement}
 */
const createTaskForm = document.getElementById('createTaskForm');

/**
 * Text input for the new task's name.
 * @type {HTMLInputElement}
 */
const taskNameInput = document.getElementById('taskNameInput');

/**
 * Confirm button that finalises task creation.
 * @type {HTMLButtonElement}
 */
const confirmCreateTask = document.getElementById('confirmCreateTask');

/**
 * Container for active (incomplete) task items.
 * @type {HTMLElement}
 */
const taskList = document.getElementById('taskList');

/**
 * Placeholder shown when there are no active tasks.
 * @type {HTMLElement}
 */
const taskEmpty = document.getElementById('taskEmpty');

/**
 * Container for completed task items.
 * @type {HTMLElement}
 */
const completedTaskList = document.getElementById('completedTaskList');

/**
 * Placeholder shown when there are no completed tasks.
 * @type {HTMLElement}
 */
const completedTaskEmpty = document.getElementById('completedTaskEmpty');

/**
 * Auto-incrementing counter used to generate unique IDs for task checkboxes.
 * @type {number}
 */
let taskCount = 0;

createTaskBtn.addEventListener('click', () => {
  createTaskForm.classList.toggle('hidden');
  if (!createTaskForm.classList.contains('hidden')) taskNameInput.focus();
});

/**
 * Creates a new task item and adds it to the active task list.
 *
 * Each task renders as a labelled checkbox. When checked, the task is
 * moved to the completed list, supporting a lightweight Agile "done"
 * workflow without a page reload.
 *
 * @returns {void} Returns early if the task name input is empty.
 */
function createTask() {
  const name = taskNameInput.value.trim();
  if (!name) return;

  taskCount++;
  const id = 'task-' + taskCount;

  const item = document.createElement('div');
  item.classList.add('check-item');
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
taskNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createTask();
});

// ── Blockers ───────────────────────────────────────────────────────────

/**
 * Button that toggles the create-blocker input form.
 * @type {HTMLButtonElement}
 */
const createBlockerBtn = document.getElementById('createBlockerBtn');

/**
 * The collapsible form used to describe a new blocker.
 * @type {HTMLElement}
 */
const createBlockerForm = document.getElementById('createBlockerForm');

/**
 * Text input for the new blocker's description.
 * @type {HTMLInputElement}
 */
const blockerDescInput = document.getElementById('blockerDescInput');

/**
 * Confirm button that finalises blocker creation.
 * @type {HTMLButtonElement}
 */
const confirmCreateBlocker = document.getElementById('confirmCreateBlocker');

/**
 * Container for active (unresolved) blocker items.
 * @type {HTMLElement}
 */
const blockerItemList = document.getElementById('blockerItemList');

/**
 * Placeholder shown when there are no active blockers — the ideal sprint state.
 * @type {HTMLElement}
 */
const blockerItemEmpty = document.getElementById('blockerItemEmpty');

/**
 * Container for resolved blocker items.
 * @type {HTMLElement}
 */
const resolvedBlockerList = document.getElementById('resolvedBlockerList');

/**
 * Placeholder shown when no blockers have been resolved yet.
 * @type {HTMLElement}
 */
const resolvedBlockerEmpty = document.getElementById('resolvedBlockerEmpty');

/**
 * Auto-incrementing counter used to generate unique IDs for blocker checkboxes.
 * @type {number}
 */
let blockerItemCount = 0;

createBlockerBtn.addEventListener('click', () => {
  createBlockerForm.classList.toggle('hidden');
  if (!createBlockerForm.classList.contains('hidden')) blockerDescInput.focus();
});

/**
 * Creates a new blocker item and adds it to the active blockers list.
 *
 * Blockers represent impediments that are preventing sprint progress.
 * Each blocker renders as a labelled checkbox; checking it marks the
 * blocker as resolved and moves it to the resolved list, giving the
 * team a clear view of what's been cleared.
 *
 * @returns {void} Returns early if the blocker description input is empty.
 */
function createBlockerItem() {
  const desc = blockerDescInput.value.trim();
  if (!desc) return;

  blockerItemCount++;
  const id = 'blocker-' + blockerItemCount;

  const item = document.createElement('div');
  item.classList.add('check-item');
  item.innerHTML = `
    <label for="${id}">${escapeHtml(desc)}</label>
    <input type="checkbox" id="${id}" />
  `;
  item.querySelector('input').addEventListener('change', () => {
    item.remove();
    if (blockerItemList.children.length === 0)
      blockerItemEmpty.style.display = '';

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
blockerDescInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createBlockerItem();
});

// ── Data Sync: Load Existing Entries ───────────────────────────────────

/**
 * Fetches and renders all previously submitted standup entries from the
 * SE SitRep API, restoring the full team status feed on page load.
 *
 * Each standup is mapped to an Agile status badge ('On track', 'In progress',
 * or 'Blocked') and prepended to the standup feed in reverse-chronological
 * order. The summary counters (submitted, blocked, in-progress) are also
 * updated to reflect the loaded history.
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} Logs a console error if the fetch request fails; does not
 *   surface an alert to avoid blocking the user on backend cold-start delays.
 */
async function loadExistingStandups() {
  try {
    const res = await fetch(`${API}/api/standups`);
    if (!res.ok) throw new Error('Failed to load standups');

    const standups = await res.json();

    if (standups.length > 0) {
      emptyState.style.display = 'none';
    }

    let statusText;
    let statusClass;
    standups.reverse().forEach((standup) => {
      const displayedStatus = standup.statusFlag;
      if (displayedStatus == 'On track') {
        statusText = 'On track'; //Literals in case we ever want to differentiate displayed text from stored flag
        statusClass = 'done';
      } else if (displayedStatus == 'In progress') {
        statusText = 'In progress';
        statusClass = 'progress';
        totalInProgress++;
      } else {
        statusText = 'Blocked';
        statusClass = 'blocker';
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

    submittedCount.textContent = totalSubmissions;
    blockerCountEl.textContent = totalBlockers;
    progressCount.textContent = totalInProgress;
  } catch (error) {
    console.error('Failed to load historical standups:', error);
  }
}

loadExistingStandups();
