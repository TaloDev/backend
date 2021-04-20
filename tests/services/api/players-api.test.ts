import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import Game from '../../../src/entities/game'
import APIKey, { APIKeyScope } from '../../../src/entities/api-key'
import { createToken } from '../../../src/services/api-keys.service'
import UserFactory from '../../fixtures/UserFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { isToday, sub } from 'date-fns'

const baseUrl = '/api/players'

describe('Players API service', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    apiKey = new APIKey(new Game('Uplift', user.organisation), user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game\'s players if the scope is valid', async () => {
    const players = await new PlayerFactory([apiKey.game]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush(players)

    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(3)

    for (let i = 0; i < res.body.players.length; i++) {
      expect(res.body.players[i].id).toBe(players[i].id)
    }
  })

  it('should not return the game\'s players without the valid scope', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should create a player if the scope is valid', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a player if the scope is valid', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .post(`${baseUrl}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should identify a player', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const player = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
  })

  it('should update the lastSeenAt when a player identifies', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const player = await new PlayerFactory([apiKey.game]).state('not seen today').one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(isToday(new Date(res.body.player.lastSeenAt))).toBe(true)
  })

  it('should not identify a player if the scope is missing', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not identify a non-existent player', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .get(`${baseUrl}/identify`)
      .query({ service: 'steam', identifier: '2131231' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should update a player\'s properties', async () => {
    const player = await new PlayerFactory([apiKey.game]).one()
    player.props = {
      collectibles: '0',
      zonesExplored: '1'
    }
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'collectibles',
        value: '1'
      },
      {
        key: 'zonesExplored',
        value: '1'
      }
    ])
  })

  it('should not update a player\'s properties if the scope is missing', async () => {
    const player = await new PlayerFactory([apiKey.game]).one()
    player.props = {
      collectibles: '0',
      zonesExplored: '1'
    }
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update a non-existent player\'s properties', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/546`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
