import request from 'supertest'
import Leaderboard from '../../../../src/entities/leaderboard'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Leaderboard - index', () => {
  it('should return a list of leaderboards', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await em.persist(leaderboards).flush()

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
    await em.persist(leaderboards).flush()

    await request(app)
      .get(`/games/${game.id}/leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter leaderboards by internalNames', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const leaderboards = await new LeaderboardFactory([game]).many(3)
    await em.persist(leaderboards).flush()

    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards?internalName=${leaderboards[1].internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboards).toHaveLength(1)
    expect(res.body.leaderboards[0].id).toBe(leaderboards[1].id)
  })

  it('should return an empty array when filtering by non-existent internalNames', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards?internalName=non-existent`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboards).toHaveLength(0)
  })
})
