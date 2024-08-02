import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Game stat service - index', () => {
  it('should return a list of game stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stats = await new GameStatFactory([game]).many(3)
    await (<EntityManager>global.em).persistAndFlush([game, ...stats])

    const res = await request(global.app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(stats.length)
  })

  it('should not return a list of game stats for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const stats = await new GameStatFactory([game]).many(3)
    await (<EntityManager>global.em).persistAndFlush([game, ...stats])

    await request(global.app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should recalculate global stat values without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()

    const player = await new PlayerFactory([game]).devBuild().one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()

    const otherPlayer = await new PlayerFactory([game]).one()
    const otherPlayerStat = await new PlayerGameStatFactory().construct(otherPlayer, stat).state(() => ({ value: 40 })).one()

    await (<EntityManager>global.em).persistAndFlush([playerStat, otherPlayerStat])

    const res = await request(global.app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats[0].globalValue).toBe(40)
  })

  it('should not recalculate global stat values with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    await (<EntityManager>global.em).persistAndFlush(playerStat)

    const res = await request(global.app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.stats[0].globalValue).toBe(50)
  })
})
