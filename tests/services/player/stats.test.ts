import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import casual from 'casual'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Player service - get stats', () => {

  it('should get a player\'s stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stats = await new GameStatFactory([game]).many(3)

    const player = await new PlayerFactory([game]).one()
    const playerStats = await new PlayerGameStatFactory().construct(player, casual.random_element(stats)).many(3)

    await (<EntityManager>global.em).persistAndFlush([player, ...playerStats])

    const res = await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(3)
  })

  it('should not get a player\'s stats for a player they have no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()

    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get a player\'s stats if they do not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/players/21312321321/stats`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
