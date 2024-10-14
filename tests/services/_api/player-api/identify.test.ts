import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { isToday } from 'date-fns'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../../../src/entities/player-group-rule'
import PlayerProp from '../../../../src/entities/player-prop'
import { RuleMode } from '../../../../src/entities/player-group'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player API service - identify', () => {
  it('should identify a player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(player.aliases[0].identifier)
    expect(res.body.alias.player.id).toBe(player.id)
  })

  it('should update the lastSeenAt when a player identifies', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).notSeenToday().one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .get('/v1/players/identify')
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await (<EntityManager>global.em).refresh(player)
    expect(isToday(new Date(player.lastSeenAt))).toBe(true)
  })

  it('should not identify a player if the scope is missing', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(global.app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not identify a non-existent player without the write scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found. Use an access key with the write:players scope to automatically create players' })
  })

  it('should identify a non-existent player by creating a new player with the write scope', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe('2131231')
    expect(res.body.alias.player.id).toBeTruthy()
  })

  it('should update group memberships based on the updated lastSeenAt', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GT, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2022-01-02']

    const propRule = new PlayerGroupRule(PlayerGroupRuleName.EQUALS, 'props.lastSeenAtTesting')
    propRule.castType = PlayerGroupRuleCastType.CHAR
    propRule.operands = ['yes']

    const group = await new PlayerGroupFactory().construct(apiKey.game).state(() => ({
      rules: [dateRule, propRule],
      ruleMode: RuleMode.AND
    })).one()
    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      lastSeenAt: new Date(2022, 0, 0),
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'lastSeenAtTesting', 'yes')
      ])
    })).one()
    await (<EntityManager>global.em).persistAndFlush([group, player])

    const playerCount = await group.members.loadCount()
    expect(playerCount).toEqual(0)

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.player.groups).toStrictEqual([{
      id: group.id,
      name: group.name
    }])
  })

  it('should not create a talo alias', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: 'talo', identifier: 'whatever' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found: Talo aliases must be created using the /v1/players/auth API' })
  })

  it('should require the service to be a non-empty string', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: '', identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        service: ['Invalid service, must be a non-empty string']
      }
    })
  })

  it('should require the identifier to be a non-empty string', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .get('/v1/players/identify')
      .query({ service: player.aliases[0].service, identifier: '' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        identifier: ['Invalid identifier, must be a non-empty string']
      }
    })
  })
})
