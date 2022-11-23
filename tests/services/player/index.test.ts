import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerProp from '../../../src/entities/player-prop'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Player service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of players', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const num = await game.players.loadCount()

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(num)
  })

  it('should not return a list of players for a non-existent game', async () => {
    const [token] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .get('/games/99999/players')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of players for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em)

    await request(app.callback())
      .get(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter players by props', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const players = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'guildName', 'The Best Guild')
      ])
    })).many(2)

    const otherPlayers = await new PlayerFactory([game]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([...players, ...otherPlayers])

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .query({ search: 'The Best Guild' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(2)
  })

  it('should filter players by aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const player = await new PlayerFactory([game]).one()
    const otherPlayers = await new PlayerFactory([game]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...otherPlayers])

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .query({ search: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should filter players by id', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const player = await new PlayerFactory([game]).with(() => ({ id: 'abc12345678' })).one()
    const otherPlayers = await new PlayerFactory([game]).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...otherPlayers])

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .query({ search: 'abc12345678' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should paginate results when getting players', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const players = await new PlayerFactory([game]).many(36)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const page = Math.floor(players.length / 25)

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(players.length % 25)
    expect(res.body.count).toBe(players.length)
  })

  it('should not return dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const players = await new PlayerFactory([game]).state('dev build').many(5)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { organisation })

    const players = await new PlayerFactory([game]).state('dev build').many(5)
    await (<EntityManager>app.context.em).persistAndFlush(players)

    const res = await request(app.callback())
      .get(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(players.length)
  })
})
