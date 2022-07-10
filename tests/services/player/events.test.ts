import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import EventFactory from '../../fixtures/EventFactory'

describe('Player service - get events', () => {
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

  it('should get a player\'s events', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...events])

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/players/${player.id}/events`)
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
      .get(`/games/${otherGame.id}/players/${player.id}/events`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should return a filtered list of events', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const events = await new EventFactory([player]).with(() => ({ name: 'Find secret' })).many(3)
    const otherEvents = await new EventFactory([player]).with(() => ({ name: 'Kill boss' })).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([...events, ...otherEvents])

    const res = await request(app.callback())
      .get(`/games/${validGame.id}/players/${player.id}/events`)
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
      .get(`/games/${validGame.id}/players/${player.id}/events`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(count % 25)
    expect(res.body.count).toBe(count)
  })

  it('should not get a player\'s events if they do not exist', async () => {
    const res = await request(app.callback())
      .get(`/games/${validGame.id}/players/21312321321/events`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
