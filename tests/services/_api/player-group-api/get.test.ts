import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'

describe('Player group API service - get', () => {
  it('should return a group if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await (<EntityManager>global.em).populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await (<EntityManager>global.em).persistAndFlush([player, group])

    const res = await request(global.app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toHaveLength(1)
  })

  it('should not return a group if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [] })).one()
    await (<EntityManager>global.em).persistAndFlush(group)

    await request(global.app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return a non-existent group', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.app)
      .get('/v1/player-groups/abcdef')
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not return group members if membersVisible is set to false', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await (<EntityManager>global.em).populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: false })).one()
    await (<EntityManager>global.em).persistAndFlush([player, group])

    const res = await request(global.app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toBeUndefined()
  })

  it('should not return dev build players in the group members without the dev data header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await (<EntityManager>global.em).populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).devBuild().one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await (<EntityManager>global.em).persistAndFlush([player, group])

    const res = await request(global.app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(0)
    expect(res.body.group.members).toHaveLength(0)
  })

  it('should return dev build players in the group members with the dev data header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_GROUPS])
    await (<EntityManager>global.em).populate(apiKey, ['game'])

    const player = await new PlayerFactory([apiKey.game]).state(() => ({ lastSeenAt: new Date(2024, 1, 2) })).devBuild().one()
    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2024-01-01']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({ rules: [dateRule], membersVisible: true })).one()
    await (<EntityManager>global.em).persistAndFlush([player, group])

    const res = await request(global.app)
      .get(`/v1/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.group.id).toBe(group.id)
    expect(res.body.group.count).toBe(1)
    expect(res.body.group.members).toHaveLength(1)
  })
})
