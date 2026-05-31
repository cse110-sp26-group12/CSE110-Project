// --- Helper to render a standup card ---
function renderStandupCard(standup, status) {
  const card = document.createElement('article');
  card.classList.add('standup-card');

  // Determine status class if not provided
  let statusClass = 'done';
  if (status === 'In progress') statusClass = 'progress';
  else if (status === 'Blocked') statusClass = 'blocker';

  card.innerHTML = `
    <div class="standup-header">
      <div>
        <h3 class="person">${standup.name}</h3>
        <p class="role">Team Member</p>
      </div>
      <span class="status ${statusClass}">${status || 'On track'}</span>
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
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      'Server did not return JSON. Run npm start and open http://localhost:3000/ instead of the Live Server URL.',
    );
  }
}

// --- Fetch all standups on load ---
async function loadStandups() {
  try {
    const response = await fetch('/api/standups');
    const responseData = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(responseData?.error || 'Failed to load standups');
    }

    const standups = Array.isArray(responseData) ? responseData : [];
    if (standups.length > 0) {
      emptyState.style.display = 'none';
      standups.forEach((s) => renderStandupCard(s));

      totalSubmissions = standups.length;
      totalBlockers = standups.filter(
        (s) => s.blockers && s.blockers.toLowerCase() !== 'none',
      ).length;
      // Note: we'd need 'status' in the backend to accurately count in-progress

      submittedCount.textContent = totalSubmissions;
      blockerCount.textContent = totalBlockers;
    }
  } catch (error) {
    console.error('Error loading standups:', error);
  }
}

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

submitButton.addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const status = document.getElementById('status').value;
  const yesterday = document.getElementById('yesterday').value.trim();
  const today = document.getElementById('today').value.trim();
  const blockers = document.getElementById('blockers').value.trim();

  if (!name || !yesterday || !today) {
    alert("Please fill out your name, yesterday's work, and today's plan.");
    return;
  }

  const payload = {
    name,
    done: yesterday,
    todo: today,
    blockers: blockers || 'none',
  };

  try {
    const response = await fetch('/api/standups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseData = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(responseData?.error || 'Failed to submit standup');
    }

    if (!responseData) {
      throw new Error('Server returned an empty response.');
    }

    const savedStandup = responseData;

    emptyState.style.display = 'none';
    renderStandupCard(savedStandup, status);

    // Update local counters
    if (status === 'In progress') totalInProgress++;
    if (payload.blockers.toLowerCase() !== 'none') totalBlockers++;
    totalSubmissions++;

    submittedCount.textContent = totalSubmissions;
    blockerCount.textContent = totalBlockers;
    progressCount.textContent = totalInProgress;

    // Reset form
    document.getElementById('name').value = '';
    document.getElementById('status').value = 'On track';
    document.getElementById('yesterday').value = '';
    document.getElementById('today').value = '';
    document.getElementById('blockers').value = '';
  } catch (error) {
    console.error('Error submitting standup:', error);
    alert('Error: ' + error.message);
  }
});

// Load existing data when page opens
window.addEventListener('DOMContentLoaded', loadStandups);
