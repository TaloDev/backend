import request from 'supertest'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Player - get stats', () => {
  it("should get a player's stats", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stats = await new GameStatFactory([game]).many(3)

    const player = await new PlayerFactory([game]).one()
    const playerStats = await Promise.all(
      stats.map((stat) => new PlayerGameStatFactory().construct(player, stat).one()),
    )

    await em.persist([player, ...playerStats]).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(3)
  })

  it("should not get a player's stats for a player they have no access to", async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()

    await em.persistAndFlush(player)

    await request(app)
      .get(`/games/${game.id}/players/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it("should not get a player's stats if they do not exist", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/players/21312321321/stats`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
