import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-keys.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'
import Leaderboard from '../../../../src/entities/leaderboard'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Game from '../../../../src/entities/game'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'

const baseUrl = '/v1/leaderboards'

describe('Leaderboards API service - get', () => {
  let app: Koa

  let game: Game
  let leaderboard: Leaderboard

  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    game = await new GameFactory(user.organisation).one()
    leaderboard = await new LeaderboardFactory([game]).one()

    apiKey = new APIKey(game, user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, leaderboard])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should get leaderboard entries if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.READ_LEADERBOARDS]
    const players = await new PlayerFactory([game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(5)

    await (<EntityManager>app.context.em).persistAndFlush([...players, ...entries])
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)
  })

  it('should get leaderboard entries for a specific alias', async () => {
    const player = await new PlayerFactory([game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ playerAlias: player.aliases[0] })).many(2)

    const otherPlayers = await new PlayerFactory([game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...entries, ...otherPlayers, ...otherEntries])
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)
  })

  it('should not get leaderboard entries if the scope is not valid', async () => {
    apiKey.scopes = []

    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get entries for a non-existent leaderboard', async () => {
    apiKey.scopes = [APIKeyScope.READ_LEADERBOARDS]

    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}/blah/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })
})
