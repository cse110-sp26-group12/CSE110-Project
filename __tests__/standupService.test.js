import {
  createStandupService,
  StandupValidationError,
} from '../service-layer/standupService.js';

function createFakeRepositories() {
  const users = [];
  const teams = [];
  const members = [];
  const standups = [];

  let nextUserId = 1;
  let nextTeamId = 1;
  let nextMemberId = 1;
  let nextStandupId = 1;

  return {
    userRepo: {
      findByUsername(userName) {
        return users.find((user) => user.user_name === userName);
      },

      create(data) {
        const user = { id: nextUserId++, ...data };
        users.push(user);
        return user;
      },
    },

    teamRepo: {
      findByInviteCode(inviteCode) {
        return teams.find((team) => team.invite_code === inviteCode);
      },

      create(data) {
        const team = { id: nextTeamId++, ...data };
        teams.push(team);
        return team;
      },
    },

    teamMemberRepo: {
      findByUserAndTeam(userId, teamId) {
        return members.find(
          (member) => member.user_id === userId && member.team_id === teamId,
        );
      },

      findById(id) {
        return members.find((member) => member.id === id);
      },

      create(data) {
        const member = { id: nextMemberId++, left_at: null, ...data };
        members.push(member);
        return member;
      },

      update(id, updates) {
        const member = this.findById(id);
        Object.assign(member, updates);
        return member;
      },

      rejoin(id, updates = {}) {
        return this.update(id, { ...updates, left_at: null });
      },
    },

    standupRepo: {
      create(data) {
        const standup = {
          id: nextStandupId++,
          created_at: new Date().toISOString(),
          ...data,
        };
        standups.push(standup);
        return standup;
      },

      listByTeam(teamId) {
        return standups.filter((standup) => standup.for_team === teamId);
      },
    },
  };
}

describe('standupService', () => {
  it('adds a normalized standup through the repositories', async () => {
    const service = createStandupService(createFakeRepositories());

    const standup = await service.addStandup({
      name: '  Jialin  ',
      done: ' implemented handler ',
      todo: ' connect service layer ',
      blockers: '',
    });

    expect(standup.name).toBe('Jialin');
    expect(standup.done).toBe('implemented handler');
    expect(standup.todo).toBe('connect service layer');
    expect(standup.blockers).toBe('none');
    expect(new Date(standup.submittedAt)).toBeInstanceOf(Date);
  });

  it('returns frontend-ready standups without exposing stored rows', async () => {
    const service = createStandupService(createFakeRepositories());
    await service.addStandup({
      name: 'Kyle',
      done: 'closed issue',
      todo: 'open pr',
      blockers: 'none',
    });

    const standups = await service.getAllStandups();
    standups[0].name = 'Changed';

    const unchangedStandups = await service.getAllStandups();
    expect(unchangedStandups[0].name).toBe('Kyle');
  });

  it('rejects missing required fields', async () => {
    const service = createStandupService(createFakeRepositories());

    await expect(
      service.addStandup({
        name: 'Cedric',
        done: '',
        todo: 'review service',
        blockers: 'none',
      }),
    ).rejects.toThrow(StandupValidationError);
  });
});
