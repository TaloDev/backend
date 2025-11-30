import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerProp from '../../../src/entities/player-prop'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import GameChannelFactory from '../../fixtures/GameChannelFactory'

describe('Player service - index', () => {
  it('should return a list of players', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const num = await game.players.loadCount()

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(num)
  })

  it('should not return a list of players for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/players')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a list of players for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter players by props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const players = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'guildName', 'The Best Guild')
      ])
    })).many(2)

    const otherPlayers = await new PlayerFactory([game]).many(3)

    await em.persistAndFlush([...players, ...otherPlayers])

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ search: 'The Best Guild', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(2)
  })

  it('should filter players by aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).one()
    const otherPlayers = await new PlayerFactory([game]).many(3)

    await em.persistAndFlush([player, ...otherPlayers])

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ search: player.aliases[0].identifier, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should filter players by id', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).state(() => ({ id: 'abc12345678' })).one()
    const otherPlayers = await new PlayerFactory([game]).many(3)

    await em.persistAndFlush([player, ...otherPlayers])

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ search: 'abc12345678', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should paginate results when getting players', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const players = await new PlayerFactory([game]).many(36)
    await em.persistAndFlush(players)

    const page = Math.floor(players.length / 25)

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(players.length % 25)
    expect(res.body.count).toBe(players.length)
    expect(res.body.itemsPerPage).toBe(25)
  })

  it('should not return dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const players = await new PlayerFactory([game]).devBuild().many(5)
    await em.persistAndFlush(players)

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const players = await new PlayerFactory([game]).devBuild().many(5)
    await em.persistAndFlush(players)

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(players.length)
  })

  it('should filter players by groups', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2022, 1, 1) })).one()
    const otherPlayers = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2023, 1, 1) })).many(3)

    const dateRule = new PlayerGroupRule(PlayerGroupRuleName.LT, 'lastSeenAt')
    dateRule.castType = PlayerGroupRuleCastType.DATETIME
    dateRule.operands = ['2023-01-01']

    const group = await new PlayerGroupFactory().construct(game).state(() => ({ rules: [dateRule] })).one()
    await em.persistAndFlush([player, ...otherPlayers, group])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ search: `group:${group.id}`, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should filter players by channels', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).one()
    const otherPlayers = await new PlayerFactory([game]).many(3)

    const channel = await new GameChannelFactory(game).one()
    channel.members.add(player.aliases[0])

    await em.persistAndFlush([player, ...otherPlayers, channel])

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ search: `channel:${channel.id}`, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players).toHaveLength(1)
  })

  it('should include player props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'level', '25')
      ])
    })).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.players[0].props).toBeDefined()
    expect(res.body.players[0].props).toHaveLength(1)
    expect(res.body.players[0].props[0].key).toBe('level')
    expect(res.body.players[0].props[0].value).toBe('25')
  })
})
