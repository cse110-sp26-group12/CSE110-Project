/**
 * Custom error for invalid standup form input.
 */
export class StandupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StandupValidationError';
  }
}

/**
 * Checks that a required text field is not empty.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 * @throws {StandupValidationError}
 */
function normalizeRequiredText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new StandupValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}

/**
 * Turns an empty blocker input into "none" so the frontend has a default value.
 *
 * @param {unknown} blockers
 * @returns {string}
 */
function normalizeBlockers(blockers) {
  if (typeof blockers !== 'string' || blockers.trim() === '') {
    return 'none';
  }

  return blockers.trim();
}

/**
 * Makes a simple username/email-safe slug from a display name.
 *
 * @param {string} name
 * @returns {string}
 */
function slugifyName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'member';
}

/**
 * Gets an existing demo user or creates one if it does not exist yet.
 *
 * @param {object} repositories
 * @param {string} userName
 * @param {string} userEmail
 * @returns {object}
 */
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

/**
 * Gets the default demo team used by the standup page.
 *
 * @param {object} repositories
 * @returns {object}
 */
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

/**
 * Gets or creates a demo membership for the person submitting the standup.
 *
 * @param {object} repositories
 * @param {string} displayName
 * @returns {object}
 */
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

/**
 * Converts a stored standup row into the shape used by the frontend.
 *
 * @param {object} row
 * @param {object} poster
 * @returns {object}
 */
function toFrontendStandup(row, poster) {
  return {
    id: row.id,
    name: poster?.display_name || 'Team Member',
    done: row.worked_on || '',
    todo: row.will_work_on || '',
    blockers: row.blocked_by || 'none',
    submittedAt: row.created_at,
    statusFlag: row.status_flag,
  };
}

/**
 * Builds the standup service. Repositories can be passed in for testing.
 *
 * @param {object} repositories
 * @returns {object}
 */
export function createStandupService(
  repositories = {
    standupRepo,
    teamMemberRepo,
    teamRepo,
    userRepo,
  },
) {
  return {
    /**
     * Validates and saves a new standup update.
     *
     * @param {object} data
     * @returns {Promise<object>}
     */
    async addStandup(data) {
      const name = normalizeRequiredText(data.name, 'name');
      const done = normalizeRequiredText(data.done, 'done');
      const todo = normalizeRequiredText(data.todo, 'todo');
      const blockers = normalizeBlockers(data.blockers);
      const statusFlag = normalizeRequiredText(data.statusFlag, 'statusFlag');

      const team = getOrCreateDemoTeam(repositories);
      const member = getOrCreateDemoMembership(repositories, name);
      const row = repositories.standupRepo.create({
        posted_by: member.id,
        for_team: team.id,
        worked_on: done,
        will_work_on: todo,
        blocked_by: blockers === 'none' ? null : blockers,
        status_flag: statusFlag,
      });

      return toFrontendStandup(row, member);
    },

    /**
     * Returns all standups for the demo team.
     *
     * @returns {Promise<object[]>}
     */
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