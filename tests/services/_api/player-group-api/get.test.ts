import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'

describe('Player group API service - get', () => {
  it('should return a group if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await em.populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await em.persistAndFlush([player, group])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toHaveLength(1)

    expect(res.body.membersPagination).toStrictEqual({
      count: 1,
      itemsPerPage: 50,
      isLastPage: true
    })
  })

  it('should not return a group if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [] })).one()
    await em.persistAndFlush(group)

    await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return a non-existent group', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])

    await request(app)
      .get('/v1/player-groups/abcdef')
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not return group members if membersVisible is set to false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await em.populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: false })).one()
    await em.persistAndFlush([player, group])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toBeUndefined()
  })

  it('should not return dev build players in the group members without the dev data header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await em.populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).devBuild().one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await em.persistAndFlush([player, group])

    const res = await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(0)
    expect(res.body.group.members).toHaveLength(0)
  })

  it('should return dev build players in the group members with the dev data header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await em.populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).devBuild().one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await em.persistAndFlush([player, group])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toHaveLength(1)
  })

  it('should should paginate player group members', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await em.populate(apiKey, ['game'])

    const players = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).many(101)
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await em.persistAndFlush([...players, group])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/v1/player-groups/${group.id}`)
      .query({ membersPage: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.members).toHaveLength(50)
    expect(res.body.membersPagination).toStrictEqual({
      count: 101,
      itemsPerPage: 50,
      isLastPage: false
    })
  })
})
