import { createStandup } from './standup.js';

const toggle = document.getElementById('themeToggle');
const submitButton = document.querySelector('.submit-btn');
const standupList = document.getElementById('standupList');
const emptyState = document.getElementById('emptyState');

const submittedCount = document.getElementById('submittedCount');
const blockerCount = document.getElementById('blockerCount');
const progressCount = document.getElementById('progressCount');

let totalSubmissions = 0;
let totalBlockers = 0;
let totalInProgress = 0;

toggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

submitButton.addEventListener('click', () => {
  const name = document.getElementById('name').value.trim();
  const status = document.getElementById('status').value;
  const yesterday = document.getElementById('yesterday').value.trim();
  const today = document.getElementById('today').value.trim();
  const blockers = document.getElementById('blockers').value.trim();

  if (!name || !yesterday || !today) {
    alert('Please fill out your name, yesterday\'s work, and today\'s plan.');
    return;
  }

  // Convert form input into a standard standup object.
  // This follows the same structure as the team's createStandup helper.
  const standup = createStandup(name, yesterday, today, blockers);

  emptyState.style.display = 'none';

  let statusClass = 'done';

  if (status === 'In progress') {
    statusClass = 'progress';
    totalInProgress++;
  } else if (status === 'Blocked') {
    statusClass = 'blocker';
  }

  if (standup.blockers) {
    totalBlockers++;
  }

  totalSubmissions++;

  const card = document.createElement('article');
  card.classList.add('standup-card');

  card.innerHTML = `
    <div class="standup-header">
      <div>
        <h3 class="person">${standup.name}</h3>
        <p class="role">Team Member</p>
      </div>
      <span class="status ${statusClass}">${status}</span>
    </div>

    <div class="standup-section">
      <strong>Yesterday</strong>
      <p>${standup.done}</p>
    </div>

    <div class="standup-section">
      <strong>Today</strong>
      <p>${standup.todo}</p>
    </div>

    <div class="standup-section">
      <strong>Blockers</strong>
      <p>${standup.blockers || 'No blockers reported.'}</p>
    </div>
  `;

  standupList.prepend(card);

  submittedCount.textContent = totalSubmissions;
  blockerCount.textContent = totalBlockers;
  progressCount.textContent = totalInProgress;

  document.getElementById('name').value = '';
  document.getElementById('status').value = 'On track';
  document.getElementById('yesterday').value = '';
  document.getElementById('today').value = '';
  document.getElementById('blockers').value = '';
});