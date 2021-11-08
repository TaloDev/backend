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

const baseUrl = '/v1/leaderboards'

describe('Leaderboards API service - post', () => {
  let app: Koa

  let game: Game
  let leaderboard: Leaderboard

  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    game = await new GameFactory(user.organisation).one()
    leaderboard = await new LeaderboardFactory([game]).state('not unique').one()

    apiKey = new APIKey(game, user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, leaderboard])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard entry if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_LEADERBOARDS]
    const player = await new PlayerFactory([game]).one()

    await (<EntityManager>app.context.em).persistAndFlush([player])
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.score).toBe(300)
  })

  it('should not create a leaderboard entry if the scope is not valid', async () => {
    apiKey.scopes = []

    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: 99, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a leaderboard entry if the alias doesn\'t exist', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_LEADERBOARDS]

    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: 99, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not create a leaderboard entry if the leaderboard doesn\'t exist', async () => {
    await request(app.callback())
      .post(`${baseUrl}/blah/entries`)
      .send({ aliasId: 99, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should update an existing entry for unique leaderboards', async () => {
    leaderboard.unique = true

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 360 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.id).toBe(prevId)
    expect(res.body.entry.score).toBe(360)
  })

  it('should add new entries for non-unique leaderboards', async () => {
    leaderboard.unique = false

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 360 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.id).not.toBe(prevId)
    expect(res.body.entry.score).toBe(360)
  })
})
