import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'
import UserFactory from '../fixtures/UserFactory'
import OrganisationFactory from '../fixtures/OrganisationFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import EventFactory from '../fixtures/EventFactory'

const baseUrl = '/players'

describe('Players service', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a player', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
  })

  it('should create a player with aliases', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        aliases: [{
          service: 'steam',
          identifier: '12345'
        }],
        gameId: validGame.id
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeDefined()
    expect(res.body.player.aliases).toHaveLength(1)
    expect(res.body.player.aliases[0].service).toBe('steam')
    expect(res.body.player.aliases[0].identifier).toBe('12345')
  })

  it('should create a player with props', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        gameId: validGame.id,
        props: [
          {
            key: 'characterName',
            value: 'Bob John'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

      expect(res.body.player.props[0].key).toBe('characterName')
      expect(res.body.player.props[0].value).toBe('Bob John')
  })

  it('should not create a player for a non-existent game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not create a player for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a player if props are in the incorrect format', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({
        gameId: validGame.id,
        props: {
          characterName: 'Bob John'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

      expect(res.body.message).toBe('Props must be an array')
  })

  it('should return a list of players', async () => {
    const num = await validGame.players.loadCount()

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(num)
  })

  it('should not return a list of players for a non-existent game', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'The specified game doesn\'t exist' })
  })

  it('should not return a list of players for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Crawle', otherOrg)
    await (<EntityManager>app.context.em).persistAndFlush(otherGame)

    await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a filtered list of players', async () => {
    const players = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'guildName',
          value: 'The Best Guild'
        }
      ]
    })).many(2)

    const otherPlayers = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'guildName',
          value: 'The Worst Guild'
        }
      ]
    })).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([...players, ...otherPlayers])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, search: 'The Best Guild' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(2)
  })

  it('should paginate results when getting players', async () => {
    const existingNum = await validGame.players.loadCount()
    const players = await new PlayerFactory([validGame]).many(36)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const count = existingNum + players.length
    const page = Math.floor(count / 25)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: validGame.id, page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(count % 25)
    expect(res.body.count).toBe(count)
  })

  it('should update a player\'s properties', async () => {
    const player = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'collectibles',
          value: '0'
        },
        {
          key: 'zonesExplored',
          value: '1'
        }
      ]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

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

      expect(res.body.player.props).toEqual(expect.arrayContaining([
        {
          key: 'collectibles',
          value: '1'
        },
        {
          key: 'zonesExplored',
          value: '1'
        }
      ]))
  })

  it('should delete null player\ properties', async () => {
    const player = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'collectibles',
          value: '1'
        },
        {
          key: 'zonesExplored',
          value: '1'
        }
      ]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'zonesExplored',
            value: null
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'collectibles',
        value: '1'
      }
    ])
  })

  it('should throw an error if props are present but aren\'t an array', async () => {
    const player = await new PlayerFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: {
          collectibles: '3'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toBe('Props must be an array')
  })

  it('should not update a non-existent player\'s properties', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/2313`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not update a player\'s properties for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Trigeon', otherOrg)
    const player = await new PlayerFactory([otherGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should get a player\'s events', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...events])

    const res = await request(app.callback())
      .get(`${baseUrl}/${player.id}/events`)
      .auth(token, { type: 'bearer' })
      .expect(200)

      expect(res.body.events).toHaveLength(3)
  })

  it('should not get a player\'s events for a player they have no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Trigeon', otherOrg)
    const player = await new PlayerFactory([otherGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    await request(app.callback())
      .get(`${baseUrl}/${player.id}/events`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a filtered list of events', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Find secret' })).many(3)
    const otherEvents = await new EventFactory([player]).with(() => ({ name: 'Kill boss' })).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([...events, ...otherEvents])

    const res = await request(app.callback())
      .get(`${baseUrl}/${player.id}/events`)
      .query({ search: 'Find secret' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
  })

  it('should paginate results when getting player events', async () => {
    const count = 42

    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).many(count)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    const page = Math.floor(count / 25)

    const res = await request(app.callback())
      .get(`${baseUrl}/${player.id}/events`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(count % 25)
    expect(res.body.count).toBe(count)
  })
})
