'use strict';

// ─── DATA ──────────────────────────────────────────────────────────────────

const MEMBERS = [
  {
    id: 1,
    name: 'Alice Chen',
    initials: 'AC',
    role: 'Frontend Lead',
    status: 'active',
    color: '#6366F1',
  },
  {
    id: 2,
    name: 'Bob Martinez',
    initials: 'BM',
    role: 'Backend Engineer',
    status: 'active',
    color: '#0EA5E9',
  },
  {
    id: 3,
    name: 'Charlie Kim',
    initials: 'CK',
    role: 'DevOps Engineer',
    status: 'away',
    color: '#F59E0B',
  },
  {
    id: 4,
    name: 'Diana Osei',
    initials: 'DO',
    role: 'QA Engineer',
    status: 'active',
    color: '#10B981',
  },
  {
    id: 5,
    name: 'Erik Johansson',
    initials: 'EJ',
    role: 'Backend Engineer',
    status: 'offline',
    color: '#8B5CF6',
  },
  {
    id: 6,
    name: 'Fatima Hassan',
    initials: 'FH',
    role: 'UX Designer',
    status: 'active',
    color: '#EC4899',
  },
];

const STANDUPS = [
  {
    id: 1,
    memberId: 1,
    date: '2026-05-08',
    yesterday:
      'Completed the redesign of the dashboard header component and fixed alignment issues in Safari.',
    today:
      'Starting work on the new data visualization charts for the analytics page.',
    blockers: 'None',
  },
  {
    id: 2,
    memberId: 2,
    date: '2026-05-08',
    yesterday:
      'Refactored the authentication middleware and added JWT refresh token logic.',
    today:
      "Writing unit tests for the new auth endpoints and reviewing Diana's PR for the user service.",
    blockers:
      'Waiting on DB schema approval from the architecture review board.',
  },
  {
    id: 3,
    memberId: 4,
    date: '2026-05-08',
    yesterday:
      'Ran regression tests on the v2.1 release candidate and documented 3 new edge cases.',
    today:
      'Finalizing the test plan for the upcoming payment module integration.',
    blockers: 'Need staging payment gateway credentials before I can continue.',
  },
  {
    id: 4,
    memberId: 6,
    date: '2026-05-08',
    yesterday:
      'Delivered final mockups for the onboarding flow redesign to the product team.',
    today:
      'Collaborating with Alice on component specs for the analytics dashboard.',
    blockers: 'None',
  },
  {
    id: 5,
    memberId: 1,
    date: '2026-05-07',
    yesterday:
      'Finished implementing the responsive nav menu and wrote Storybook stories for it.',
    today: 'Completing the dashboard header component redesign.',
    blockers: 'None',
  },
  {
    id: 6,
    memberId: 3,
    date: '2026-05-07',
    yesterday:
      'Deployed the new CI/CD pipeline changes to staging and fixed three flaky build steps.',
    today:
      'Monitoring staging performance and writing the new deployment runbook.',
    blockers:
      'Kubernetes resource quotas on staging need to be raised by the infra team.',
  },
  {
    id: 7,
    memberId: 5,
    date: '2026-05-07',
    yesterday:
      'Investigated Redis connection pooling issues causing intermittent timeouts.',
    today:
      'Implementing a fix for the connection pool exhaustion in the event processor.',
    blockers:
      'Redis connection pooling causes timeouts under load — critical issue, escalated to infra.',
  },
];

const BLOCKERS = [
  {
    id: 1,
    memberId: 5,
    description:
      'Redis connection pool exhaustion causing intermittent timeouts in the event processing service under load.',
    severity: 'critical',
    date: '2026-05-08',
    status: 'active',
  },
  {
    id: 2,
    memberId: 2,
    description:
      'Waiting on DB schema approval from the architecture review board before proceeding with the user service migration.',
    severity: 'high',
    date: '2026-05-07',
    status: 'active',
  },
  {
    id: 3,
    memberId: 4,
    description:
      'Need access to the staging payment gateway credentials to continue integration testing.',
    severity: 'medium',
    date: '2026-05-08',
    status: 'active',
  },
  {
    id: 4,
    memberId: 3,
    description:
      'Kubernetes resource quotas on staging are preventing full load testing. Requested infra team increase limits.',
    severity: 'medium',
    date: '2026-05-06',
    status: 'active',
  },
  {
    id: 5,
    memberId: 1,
    description:
      'Safari CSS Grid rendering bug causing inconsistent column widths in the legacy dashboard widget.',
    severity: 'low',
    date: '2026-05-05',
    status: 'resolved',
  },
];

const WORK = [
  {
    memberId: 1,
    task: 'Analytics Dashboard Redesign',
    ticket: 'FE-234',
    sprint: 'Sprint 12',
    progress: 65,
    status: 'in-progress',
  },
  {
    memberId: 2,
    task: 'Auth Middleware Refactor',
    ticket: 'BE-891',
    sprint: 'Sprint 12',
    progress: 80,
    status: 'in-review',
  },
  {
    memberId: 3,
    task: 'CI/CD Pipeline Improvements',
    ticket: 'OPS-45',
    sprint: 'Sprint 12',
    progress: 90,
    status: 'in-review',
  },
  {
    memberId: 4,
    task: 'Payment Module Test Plan',
    ticket: 'QA-112',
    sprint: 'Sprint 12',
    progress: 40,
    status: 'in-progress',
  },
  {
    memberId: 5,
    task: 'Event Processing Service Fix',
    ticket: 'BE-904',
    sprint: 'Sprint 12',
    progress: 25,
    status: 'blocked',
  },
  {
    memberId: 6,
    task: 'Onboarding Flow Redesign',
    ticket: 'UX-67',
    sprint: 'Sprint 12',
    progress: 95,
    status: 'done',
  },
];

const COVER = [
  {
    id: 1,
    memberId: 3,
    startDate: '2026-05-12',
    endDate: '2026-05-16',
    reason:
      'Family vacation — will be fully out of office for the week. Oncall duties need handoff.',
    status: 'open',
    volunteers: [],
  },
  {
    id: 2,
    memberId: 5,
    startDate: '2026-05-20',
    endDate: '2026-05-21',
    reason:
      'Medical appointment and recovery day. PR reviews and Slack monitoring need coverage.',
    status: 'filled',
    volunteers: [2],
  },
];

// Meeting availability — keyed by member id, value is Set of "day-slotIdx" strings
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const HOURS = [
  '9:00',
  '9:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '1:00',
  '1:30',
  '2:00',
  '2:30',
  '3:00',
  '3:30',
  '4:00',
  '4:30',
  '5:00',
  '5:30',
];

const TEAM_AVAIL = {
  1: new Set([
    'mon-0',
    'mon-1',
    'mon-2',
    'mon-3',
    'mon-4',
    'mon-5',
    'tue-0',
    'tue-1',
    'tue-2',
    'wed-2',
    'wed-3',
    'wed-4',
    'thu-0',
    'thu-1',
    'thu-2',
    'fri-2',
    'fri-3',
    'fri-4',
  ]),
  2: new Set([
    'mon-2',
    'mon-3',
    'mon-4',
    'mon-5',
    'tue-2',
    'tue-3',
    'tue-4',
    'tue-5',
    'wed-0',
    'wed-1',
    'wed-2',
    'thu-4',
    'thu-5',
    'thu-6',
    'fri-0',
    'fri-1',
    'fri-2',
    'fri-3',
  ]),
  3: new Set([
    'mon-0',
    'mon-1',
    'mon-2',
    'tue-0',
    'tue-6',
    'tue-7',
    'wed-4',
    'wed-5',
    'wed-6',
    'thu-2',
    'thu-3',
    'thu-4',
    'fri-6',
    'fri-7',
    'fri-8',
  ]),
  4: new Set([
    'mon-4',
    'mon-5',
    'mon-6',
    'tue-2',
    'tue-3',
    'tue-4',
    'wed-0',
    'wed-1',
    'wed-2',
    'wed-3',
    'thu-0',
    'thu-1',
    'thu-2',
    'thu-3',
    'fri-0',
    'fri-1',
  ]),
  5: new Set([
    'mon-6',
    'mon-7',
    'mon-8',
    'tue-6',
    'tue-7',
    'tue-8',
    'wed-6',
    'wed-7',
    'wed-8',
    'thu-6',
    'thu-7',
    'thu-8',
    'fri-6',
    'fri-7',
    'fri-8',
  ]),
  6: new Set([
    'mon-0',
    'mon-1',
    'mon-2',
    'mon-3',
    'tue-0',
    'tue-1',
    'tue-2',
    'wed-0',
    'wed-1',
    'thu-0',
    'thu-1',
    'thu-2',
    'fri-2',
    'fri-3',
    'fri-4',
    'fri-5',
  ]),
};

let myAvail = new Set([
  'mon-2',
  'mon-3',
  'mon-4',
  'tue-2',
  'tue-3',
  'wed-0',
  'wed-1',
  'wed-2',
  'thu-2',
  'thu-3',
  'fri-0',
  'fri-1',
  'fri-2',
]);

// ─── HELPERS ───────────────────────────────────────────────────────────────

const getMember = (id) => MEMBERS.find((m) => m.id === id);

const statusLabel = (s) =>
  ({ active: 'Active', away: 'Away', offline: 'Offline' })[s] || s;
const statusDotClass = (s) =>
  ({ active: 'sd-active', away: 'sd-away', offline: 'sd-offline' })[s] ||
  'sd-offline';
const statusBadge = (s) =>
  ({
    active: '<span class="badge bg-green">● Active</span>',
    away: '<span class="badge bg-yellow">● Away</span>',
    offline: '<span class="badge bg-gray">● Offline</span>',
  })[s] || '';

const severityColor = (s) =>
  ({ critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#3B82F6' })[
    s
  ];
const severityBadge = (s) => {
  const cls =
    {
      critical: 'bg-red',
      high: 'bg-orange',
      medium: 'bg-yellow',
      low: 'bg-blue',
    }[s] || 'bg-gray';
  return `<span class="badge ${cls}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
};

const workStatusInfo = (s) =>
  ({
    'in-progress': { label: 'In Progress', cls: 'bg-blue' },
    'in-review': { label: 'In Review', cls: 'bg-purple' },
    blocked: { label: 'Blocked', cls: 'bg-red' },
    done: { label: 'Done', cls: 'bg-green' },
    planned: { label: 'Planned', cls: 'bg-gray' },
  })[s] || { label: s, cls: 'bg-gray' };

const progressColor = (p) =>
  p >= 90 ? '#10B981' : p >= 60 ? '#6366F1' : p >= 30 ? '#F59E0B' : '#EF4444';

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
function formatDateRange(s, e) {
  return `${formatDate(s)} → ${formatDate(e)}`;
}

function toast(msg, icon = '✓') {
  const t = document.getElementById('toast');
  t.querySelector('.t-icon').textContent = icon;
  t.querySelector('.t-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────

const SECTION_META = {
  team: { title: 'Team Status', sub: 'Real-time view of your SE team' },
  standups: {
    title: 'Daily Standups',
    sub: 'Async standup feed — visible to all team members',
  },
  schedule: {
    title: 'Meeting Scheduler',
    sub: 'Set your availability and see when the team is free',
  },
  blockers: {
    title: 'Blockers',
    sub: 'Track issues hindering team productivity',
  },
  work: {
    title: 'Current Work',
    sub: 'What each member is working on this sprint',
  },
  cover: {
    title: 'Cover Requests',
    sub: 'Manage out-of-office coverage requests',
  },
};

function navTo(id) {
  document
    .querySelectorAll('.nav-item')
    .forEach((el) => el.classList.toggle('active', el.dataset.section === id));
  document
    .querySelectorAll('.section')
    .forEach((el) => el.classList.toggle('active', el.id === `section-${id}`));
  const meta = SECTION_META[id];
  document.getElementById('tb-title').textContent = meta.title;
  document.getElementById('tb-sub').textContent = '— ' + meta.sub;
}

// ─── RENDER: TEAM ──────────────────────────────────────────────────────────

function renderTeam() {
  const workMap = Object.fromEntries(WORK.map((w) => [w.memberId, w]));
  document.getElementById('team-grid').innerHTML = MEMBERS.map((m) => {
    const w = workMap[m.id];
    return `
      <div class="member-card">
        <div class="member-top">
          <div class="member-avatar" style="background:${m.color}">
            ${m.initials}
            <span class="status-dot ${statusDotClass(m.status)}"></span>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="member-name">${m.name}</div>
            <div class="member-role">${m.role}</div>
          </div>
          ${statusBadge(m.status)}
        </div>
        <div class="member-task-box">
          <div class="mtb-label">Currently Working On</div>
          ${
            w
              ? `<div class="mtb-task">${w.task} <span class="ticket" style="margin-left:4px;">${w.ticket}</span></div>
               <div class="mini-progress">
                 <div class="progress-bar"><div class="progress-fill" style="width:${w.progress}%;background:${progressColor(w.progress)};"></div></div>
                 <span class="progress-pct">${w.progress}%</span>
               </div>`
              : `<div class="mtb-task" style="color:#94A3B8;font-style:italic;">No active task</div>`
          }
        </div>
      </div>`;
  }).join('');
}

// ─── RENDER: STANDUPS ──────────────────────────────────────────────────────

function renderStandups() {
  const sorted = [...STANDUPS].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  );
  const groups = {};
  sorted.forEach((s) => {
    (groups[s.date] = groups[s.date] || []).push(s);
  });

  document.getElementById('standup-feed').innerHTML = Object.entries(groups)
    .map(
      ([date, entries]) => `
    <div class="standup-date-group">
      <div class="standup-group-header">
        <span>${formatDate(date)}</span>
        <span class="text-muted text-sm">${entries.length} update${entries.length !== 1 ? 's' : ''}</span>
      </div>
      ${entries
        .map((s) => {
          const m = getMember(s.memberId);
          if (!m) return '';
          const hasBlocker =
            s.blockers && s.blockers.trim().toLowerCase() !== 'none';
          return `
          <div class="standup-entry">
            <div class="sa-avatar" style="background:${m.color}">${m.initials}</div>
            <div class="sa-body">
              <div class="sa-meta">
                <span class="sa-name">${m.name}</span>
                <span class="sa-role-tag">${m.role}</span>
                ${hasBlocker ? '<span class="badge bg-red" style="font-size:11px;">⚠ Blocker</span>' : ''}
              </div>
              <div class="sa-items">
                <div class="sa-item"><label>Yesterday</label><p>${s.yesterday}</p></div>
                <div class="sa-item"><label>Today</label><p>${s.today}</p></div>
                <div class="sa-item">
                  <label>Blockers</label>
                  <p>${
                    hasBlocker
                      ? `<span class="blocker-inline">${s.blockers}</span>`
                      : '<span style="color:#94A3B8;">None</span>'
                  }</p>
                </div>
              </div>
            </div>
          </div>`;
        })
        .join('')}
    </div>`,
    )
    .join('');
}

function submitStandup(e) {
  e.preventDefault();
  const f = e.target;
  const yesterday = f.querySelector('[name=yesterday]').value.trim();
  const today = f.querySelector('[name=today]').value.trim();
  const blockers = f.querySelector('[name=blockers]').value.trim();
  if (!yesterday || !today) return;

  if (!getMember(-1))
    MEMBERS.unshift({
      id: -1,
      name: 'You',
      initials: 'ME',
      role: 'Software Engineer',
      status: 'active',
      color: '#6366F1',
    });
  STANDUPS.unshift({
    id: Date.now(),
    memberId: -1,
    date: '2026-05-08',
    yesterday,
    today,
    blockers: blockers || 'None',
  });
  f.reset();
  renderStandups();
  toast('Standup posted!');
}

// ─── RENDER: SCHEDULE ──────────────────────────────────────────────────────

function renderSchedule() {
  renderMyGrid();
  renderTeamGrid();
}

function renderMyGrid() {
  document.getElementById('my-grid-body').innerHTML = HOURS.map(
    (h, ri) => `
    <div class="g-row">
      <div class="g-time">${h}</div>
      ${DAYS.map((d) => {
        const key = `${d}-${ri}`;
        return `<div class="g-cell${myAvail.has(key) ? ' avail' : ''}" data-key="${key}" onclick="toggleSlot('${key}')"></div>`;
      }).join('')}
    </div>`,
  ).join('');
}

function toggleSlot(key) {
  myAvail.has(key) ? myAvail.delete(key) : myAvail.add(key);
  const el = document.querySelector(`.g-cell[data-key="${key}"]`);
  if (el) el.classList.toggle('avail');
  renderTeamGrid();
}

function clearMyAvail() {
  myAvail.clear();
  renderMyGrid();
  renderTeamGrid();
}

function renderTeamGrid() {
  const total = MEMBERS.length + 1;
  const allAvail = { ...TEAM_AVAIL, 0: myAvail };

  document.getElementById('team-grid-body').innerHTML = HOURS.map(
    (h, ri) => `
    <div class="g-row">
      <div class="g-time">${h}</div>
      ${DAYS.map((d) => {
        const key = `${d}-${ri}`;
        const count = Object.values(allAvail).filter((s) => s.has(key)).length;
        const level = Math.min(6, Math.round((count / total) * 6));
        return `<div class="g-cell heat-cell h${level}" title="${count} of ${total} available"></div>`;
      }).join('')}
    </div>`,
  ).join('');
}

// ─── RENDER: BLOCKERS ──────────────────────────────────────────────────────

function renderBlockers() {
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...BLOCKERS].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
  });

  document.getElementById('blocker-list').innerHTML = sorted
    .map((b) => {
      const m = getMember(b.memberId);
      if (!m) return '';
      const resolved = b.status === 'resolved';
      return `
      <div class="blocker-card${resolved ? ' resolved' : ''}">
        <div class="blocker-bar" style="background:${resolved ? '#10B981' : severityColor(b.severity)}"></div>
        <div class="blocker-body">
          <div class="blocker-top">
            <div class="mini-av" style="background:${m.color}">${m.initials}</div>
            <span class="blocker-member">${m.name}</span>
            ${
              resolved
                ? '<span class="badge bg-green">✓ Resolved</span>'
                : severityBadge(b.severity)
            }
            <span class="text-muted text-xs" style="margin-left:auto;">${formatDate(b.date)}</span>
          </div>
          <div class="blocker-desc">${b.description}</div>
          <div class="blocker-foot">
            <span>${m.role}</span>
            ${
              !resolved
                ? `<button class="btn btn-xs btn-secondary" onclick="resolveBlocker(${b.id})">Mark Resolved</button>`
                : ''
            }
          </div>
        </div>
      </div>`;
    })
    .join('');

  const active = BLOCKERS.filter((b) => b.status === 'active').length;
  document.getElementById('active-blocker-count').textContent =
    ` — ${active} active`;
  document.getElementById('blocker-nav-badge').textContent = active;
}

function resolveBlocker(id) {
  const b = BLOCKERS.find((x) => x.id === id);
  if (b) {
    b.status = 'resolved';
    renderBlockers();
    toast('Blocker marked as resolved');
  }
}

function openBlockerModal() {
  const sel = document.querySelector('#blocker-modal [name=member]');
  sel.innerHTML = MEMBERS.map(
    (m) => `<option value="${m.id}">${m.name} — ${m.role}</option>`,
  ).join('');
  document.getElementById('blocker-modal').classList.add('open');
}
function closeBlockerModal() {
  document.getElementById('blocker-modal').classList.remove('open');
  document.getElementById('blocker-form').reset();
}
function submitBlocker(e) {
  e.preventDefault();
  const f = e.target;
  const memberId = parseInt(f.querySelector('[name=member]').value);
  const description = f.querySelector('[name=description]').value.trim();
  const severity = f.querySelector('[name=severity]').value;
  if (!description) return;
  BLOCKERS.push({
    id: Date.now(),
    memberId,
    description,
    severity,
    date: '2026-05-08',
    status: 'active',
  });
  closeBlockerModal();
  renderBlockers();
  toast('Blocker added to the board', '⚠');
}

// ─── RENDER: WORK ──────────────────────────────────────────────────────────

function renderWork() {
  document.getElementById('work-tbody').innerHTML = WORK.map((w) => {
    const m = getMember(w.memberId);
    if (!m) return '';
    const si = workStatusInfo(w.status);
    return `
      <tr>
        <td>
          <div class="mcell">
            <div class="mini-av" style="background:${m.color}">${m.initials}</div>
            <div>
              <div class="font-semi">${m.name}</div>
              <div class="text-xs text-muted">${m.role}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="font-semi">${w.task}</div>
          <div style="margin-top:3px;"><span class="ticket">${w.ticket}</span></div>
        </td>
        <td><span class="badge ${si.cls}">${si.label}</span></td>
        <td>
          <div class="work-prog">
            <div class="prog-bar"><div class="prog-fill" style="width:${w.progress}%;background:${progressColor(w.progress)};"></div></div>
            <span class="text-xs font-bold" style="width:32px;">${w.progress}%</span>
          </div>
        </td>
        <td class="text-muted text-sm">${w.sprint}</td>
      </tr>`;
  }).join('');
}

// ─── RENDER: COVER ─────────────────────────────────────────────────────────

function renderCover() {
  document.getElementById('cover-grid').innerHTML = COVER.map((c) => {
    const m = getMember(c.memberId);
    if (!m) return '';
    const filled = c.status === 'filled';
    const volNames = c.volunteers
      .map((vid) => getMember(vid)?.name || 'Someone')
      .join(', ');
    return `
      <div class="cover-card">
        <div class="cover-head">
          <div class="mini-av" style="background:${m.color}">${m.initials}</div>
          <div style="flex:1;">
            <div class="font-semi">${m.name}</div>
            <div class="text-xs text-muted">${m.role}</div>
          </div>
          ${
            filled
              ? '<span class="badge bg-green">✓ Covered</span>'
              : '<span class="badge bg-yellow">Needs Cover</span>'
          }
        </div>
        <div class="cover-dates">📅 ${formatDateRange(c.startDate, c.endDate)}</div>
        <div class="cover-reason">${c.reason}</div>
        <div class="cover-foot">
          <div class="volunteer-info">
            ${
              filled
                ? `Covered by: <strong>${volNames}</strong>`
                : 'No volunteers yet'
            }
          </div>
          ${
            !filled
              ? `<button class="btn btn-sm btn-primary" onclick="volunteer(${c.id})">Volunteer</button>`
              : ''
          }
        </div>
      </div>`;
  }).join('');

  const open = COVER.filter((c) => c.status === 'open').length;
  document.getElementById('open-cover-count').textContent = open;
  document.getElementById('cover-nav-badge').textContent = open;
  if (open === 0)
    document.getElementById('cover-nav-badge').style.display = 'none';
  else document.getElementById('cover-nav-badge').style.display = '';
}

function volunteer(id) {
  const c = COVER.find((x) => x.id === id);
  if (c) {
    c.volunteers.push(-1);
    c.status = 'filled';
    renderCover();
    toast("You've volunteered to cover this request!", '🙌');
  }
}

function openCoverModal() {
  document.getElementById('cover-modal').classList.add('open');
}
function closeCoverModal() {
  document.getElementById('cover-modal').classList.remove('open');
  document.getElementById('cover-form').reset();
}
function submitCover(e) {
  e.preventDefault();
  const f = e.target;
  const startDate = f.querySelector('[name=startDate]').value;
  const endDate = f.querySelector('[name=endDate]').value;
  const reason = f.querySelector('[name=reason]').value.trim();
  if (!startDate || !endDate || !reason) return;
  COVER.push({
    id: Date.now(),
    memberId: -1,
    startDate,
    endDate,
    reason,
    status: 'open',
    volunteers: [],
  });
  if (!getMember(-1))
    MEMBERS.unshift({
      id: -1,
      name: 'You',
      initials: 'ME',
      role: 'Software Engineer',
      status: 'active',
      color: '#6366F1',
    });
  closeCoverModal();
  renderCover();
  toast('Cover request submitted!');
}

// ─── INIT ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderTeam();
  renderStandups();
  renderSchedule();
  renderBlockers();
  renderWork();
  renderCover();
  navTo('team');

  document
    .getElementById('standup-form')
    .addEventListener('submit', submitStandup);
  document
    .getElementById('blocker-form')
    .addEventListener('submit', submitBlocker);
  document.getElementById('cover-form').addEventListener('submit', submitCover);
});
