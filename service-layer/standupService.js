import {
  standupRepo,
  teamMemberRepo,
  teamRepo,
  userRepo,
} from '../data-repo/dataRepository.js';

const DEFAULT_TEAM_INVITE_CODE = 'standup-demo-team';
const DEFAULT_TEAM_NAME = 'Standup Demo Team';
const DEFAULT_OWNER_USERNAME = 'standup-demo-owner';
const DEFAULT_OWNER_EMAIL = 'standup-demo-owner@example.test';
const DEFAULT_PASS_HASH = 'not-used-in-demo';

export class StandupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StandupValidationError';
  }
}

function normalizeRequiredText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new StandupValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeBlockers(blockers) {
  if (typeof blockers !== 'string' || blockers.trim() === '') {
    return 'none';
  }

  return blockers.trim();
}

function slugifyName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'member';
}

function getOrCreateUser(repositories, userName, userEmail) {
  return (
    repositories.userRepo.findByUsername(userName) ||
    repositories.userRepo.create({
      user_name: userName,
      user_email: userEmail,
      pass_hash: DEFAULT_PASS_HASH,
    })
  );
}

function getOrCreateDemoTeam(repositories) {
  const owner = getOrCreateUser(
    repositories,
    DEFAULT_OWNER_USERNAME,
    DEFAULT_OWNER_EMAIL,
  );

  return (
    repositories.teamRepo.findByInviteCode(DEFAULT_TEAM_INVITE_CODE) ||
    repositories.teamRepo.create({
      team_name: DEFAULT_TEAM_NAME,
      invite_code: DEFAULT_TEAM_INVITE_CODE,
      owned_by: owner.id,
    })
  );
}

function getOrCreateDemoMembership(repositories, displayName) {
  const team = getOrCreateDemoTeam(repositories);
  const memberSlug = slugifyName(displayName);
  const user = getOrCreateUser(
    repositories,
    `standup-${memberSlug}`,
    `standup-${memberSlug}@example.test`,
  );

  const membership = repositories.teamMemberRepo.findByUserAndTeam(
    user.id,
    team.id,
    { includeFormer: true },
  );

  if (!membership) {
    return repositories.teamMemberRepo.create({
      user_id: user.id,
      team_id: team.id,
      display_name: displayName,
    });
  }

  if (membership.left_at) {
    return repositories.teamMemberRepo.rejoin(membership.id, {
      display_name: displayName,
    });
  }

  if (membership.display_name !== displayName) {
    return repositories.teamMemberRepo.update(membership.id, {
      display_name: displayName,
    });
  }

  return membership;
}

function toFrontendStandup(row, poster) {
  return {
    id: row.id,
    name: poster?.display_name || 'Team Member',
    done: row.worked_on || '',
    todo: row.will_work_on || '',
    blockers: row.blocked_by || 'none',
    submittedAt: row.created_at,
  };
}

export function createStandupService(
  repositories = {
    standupRepo,
    teamMemberRepo,
    teamRepo,
    userRepo,
  },
) {
  return {
    async addStandup(data) {
      const name = normalizeRequiredText(data.name, 'name');
      const done = normalizeRequiredText(data.done, 'done');
      const todo = normalizeRequiredText(data.todo, 'todo');
      const blockers = normalizeBlockers(data.blockers);

      const team = getOrCreateDemoTeam(repositories);
      const member = getOrCreateDemoMembership(repositories, name);
      const row = repositories.standupRepo.create({
        posted_by: member.id,
        for_team: team.id,
        worked_on: done,
        will_work_on: todo,
        blocked_by: blockers === 'none' ? null : blockers,
      });

      return toFrontendStandup(row, member);
    },

    async getAllStandups() {
      const team = getOrCreateDemoTeam(repositories);

      return repositories.standupRepo.listByTeam(team.id).map((row) => {
        const poster = repositories.teamMemberRepo.findById(row.posted_by, {
          includeFormer: true,
        });

        return toFrontendStandup(row, poster);
      });
    },
  };
}

export const standupService = createStandupService();
