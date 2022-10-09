import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import Game from '../../../../src/entities/game'
import Player from '../../../../src/entities/player'
import User from '../../../../src/entities/user'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameFactory from '../../../fixtures/GameFactory'
import { isToday } from 'date-fns'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../../../src/entities/player-group-rule'
import PlayerProp from '../../../../src/entities/player-prop'
import { RuleMode } from '../../../../src/entities/player-group'

const baseUrl = '/v1/players'

describe('Player API service - identify', () => {
  let app: Koa
  let token: string
  let user: User
  let game: Game

  beforeAll(async () => {
    app = await init()
    user = await new UserFactory().one()
    game = await new GameFactory(user.organisation).one()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should identify a player', async () => {
    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    const player = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(player.aliases[0].identifier)
    expect(res.body.alias.player.id).toBe(player.id)
  })

  it('should update the lastSeenAt when a player identifies', async () => {
    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    let player = await new PlayerFactory([apiKey.game]).state('not seen today').one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await (<EntityManager>app.context.em).clear()
    player = await (<EntityManager>app.context.em).getRepository(Player).findOne(player.id)

    expect(isToday(new Date(player.lastSeenAt))).toBe(true)
  })

  it('should not identify a player if the scope is missing', async () => {
    const apiKey = new APIKey(game, user)
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not identify a non-existent player without the write scope', async () => {
    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found. Use an access key with the write:players scope to automatically create players' })
  })

  it('should identify a non-existent player by creating a new player with the write scope', async () => {
    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe('2131231')
    expect(res.body.alias.player.id).toBeTruthy()
  })

  it('should update group memberships based on the updated lastSeenAt', async () => {
    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
    token = await createToken(apiKey)

    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.GT, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2022-01-02']

    const propRule = new PlayerGroupRule(PlayerGroupRuleName.EQUALS, 'props.lastSeenAtTesting')
    propRule.castType = PlayerGroupRuleCastType.CHAR
    propRule.operands = ['yes']

    const group = await new PlayerGroupFactory().construct(apiKey.game).with(() => ({
      rules: [dateRule, propRule],
      ruleMode: RuleMode.AND
    })).one()
    const player = await new PlayerFactory([apiKey.game]).with((player) => ({
      lastSeenAt: new Date(2022, 0, 0),
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'lastSeenAtTesting', 'yes')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush([group, player])

    const playerCount = await group.members.loadCount()
    expect(playerCount).toEqual(0)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.player.groups).toStrictEqual([{
      id: group.id,
      name: group.name
    }])
  })
})
