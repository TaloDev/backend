import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Leaderboard service - index', () => {
  it('should return a list of leaderboards', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await (<EntityManager>global.em).persistAndFlush(leaderboards)

    const res = await request(global.app)
      .get(`/games/${game.id}/leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.leaderboards.forEach((leaderboard, idx) => {
      expect(leaderboard.id).toBe(leaderboards[idx].id)
    })
  })

  it('should not return leaderboards for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/99999/leaderboards')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return leaderboards for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await (<EntityManager>global.em).persistAndFlush(leaderboards)

    await request(global.app)
      .get(`/games/${game.id}/leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
