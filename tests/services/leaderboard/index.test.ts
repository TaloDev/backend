import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import Leaderboard from '../../../src/entities/leaderboard'

describe('Leaderboard service - index', () => {
  it('should return a list of leaderboards', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await em.persistAndFlush(leaderboards)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.leaderboards.forEach((leaderboard: Leaderboard, idx: number) => {
      expect(leaderboard.id).toBe(leaderboards[idx].id)
    })
  })

  it('should not return leaderboards for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/leaderboards')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return leaderboards for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await em.persistAndFlush(leaderboards)

    await request(app)
      .get(`/games/${game.id}/leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
