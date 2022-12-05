import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Leaderboard service - search', () => {
  it('should return a leaderboard with the same internalName', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const leaderboard = await new LeaderboardFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/search?internalName=${leaderboard.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.id).toBe(leaderboard.id)
  })

  it('should not return leaderboards for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/1234/leaderboards/search?internalName=blah')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return leaderboards from another game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, otherGame] = await createOrganisationAndGame()
    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards/search?internalName=${leaderboard.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
