import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerProp from '../../../../src/entities/player-prop'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Player service - get', () => {
  it('should return a player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
    expect(res.body.player.aliases).toHaveLength(player.aliases.length)
  })

  it('should return 404 for a non-existent player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/players/non-existent-id`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return a player for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [otherToken] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    await request(app)
      .get(`/games/${game.id}/players/${player.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(403)
  })

  it('should ensure players have aliases and props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'level', '25'),
        new PlayerProp(player, 'username', 'TestPlayer')
      ])
    })).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.aliases).toHaveLength(player.aliases.length)
    expect(res.body.player.aliases[0]).toHaveProperty('id')
    expect(res.body.player.aliases[0]).toHaveProperty('service')
    expect(res.body.player.aliases[0]).toHaveProperty('identifier')
    expect(res.body.player.aliases[0].service).toBe(player.aliases[0].service)
    expect(res.body.player.aliases[0].identifier).toBe(player.aliases[0].identifier)

    expect(res.body.player.props).toHaveLength(player.props.length)
    expect(res.body.player.props[0].key).toBe(player.props[0].key)
    expect(res.body.player.props[0].value).toBe(player.props[0].value)
    expect(res.body.player.props[1].key).toBe(player.props[1].key)
    expect(res.body.player.props[1].value).toBe(player.props[1].value)
  })

  it('should not return a player from a different game', async () => {
    const [organisation1, game1] = await createOrganisationAndGame()
    const [, game2] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation: organisation1 })

    const player = await new PlayerFactory([game2]).one()
    await em.persist(player).flush()

    await request(app)
      .get(`/games/${game1.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404)
  })
})
