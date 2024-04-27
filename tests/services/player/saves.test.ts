import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import GameSaveFactory from '../../fixtures/GameSaveFactory'

describe('Player service - get saves', () => {

  it('should get a player\'s saves', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const saves = await new GameSaveFactory([player]).many(3)

    await (<EntityManager>global.em).persistAndFlush([player, ...saves])

    const res = await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/saves`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.saves).toHaveLength(3)
  })

  it('should not get a player\'s saves for a player they have no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()

    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/saves`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get a player\'s saves if they do not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/players/21312321321/saves`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
