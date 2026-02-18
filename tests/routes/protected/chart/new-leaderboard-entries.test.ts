import request from 'supertest'
import { subDays, format, startOfDay } from 'date-fns'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Chart - new leaderboard entries', () => {
  it('should return leaderboard entry counts by day', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'high-scores' })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persist([leaderboard, player]).flush()
    await player.aliases.loadItems()

    const today = new Date()
    const yesterday = subDays(today, 1)
    const twoDaysAgo = subDays(today, 2)

    const entries = [
      // 3 entries today
      ...await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ createdAt: today })).many(3),
      // 2 entries yesterday
      ...await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ createdAt: yesterday })).many(2),
      // 1 entry two days ago
      ...await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ createdAt: twoDaysAgo })).many(1)
    ]
    await em.persist(entries).flush()

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboardNames).toContain('high-scores')
    expect(res.body.data).toHaveLength(3)

    const twoDaysAgoData = res.body.data.find((d: { date: number }) =>
      d.date === startOfDay(twoDaysAgo).getTime()
    )
    const yesterdayData = res.body.data.find((d: { date: number }) =>
      d.date === startOfDay(yesterday).getTime()
    )
    const todayData = res.body.data.find((d: { date: number }) =>
      d.date === startOfDay(today).getTime()
    )

    expect(twoDaysAgoData.leaderboards['high-scores']).toBe(1)
    expect(twoDaysAgoData.change['high-scores']).toBe(1)
    expect(yesterdayData.leaderboards['high-scores']).toBe(2)
    expect(yesterdayData.change['high-scores']).toBe(1)
    expect(todayData.leaderboards['high-scores']).toBe(3)
    expect(todayData.change['high-scores']).toBe(0.5)
  })

  it('should return counts for multiple leaderboards', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard1 = await new LeaderboardFactory([game]).state(() => ({ internalName: 'kills' })).one()
    const leaderboard2 = await new LeaderboardFactory([game]).state(() => ({ internalName: 'deaths' })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persist([leaderboard1, leaderboard2, player]).flush()
    await player.aliases.loadItems()

    const today = new Date()

    const entries = [
      // 5 entries for leaderboard1
      ...await new LeaderboardEntryFactory(leaderboard1, [player]).state(() => ({ createdAt: today })).many(5),
      // 3 entries for leaderboard2
      ...await new LeaderboardEntryFactory(leaderboard2, [player]).state(() => ({ createdAt: today })).many(3)
    ]
    await em.persist(entries).flush()

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboardNames).toContain('kills')
    expect(res.body.leaderboardNames).toContain('deaths')
    expect(res.body.data[0].leaderboards['kills']).toBe(5)
    expect(res.body.data[0].leaderboards['deaths']).toBe(3)
  })

  it('should fill gaps with zero counts', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'score' })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persist([leaderboard, player]).flush()
    await player.aliases.loadItems()

    const today = new Date()
    const threeDaysAgo = subDays(today, 3)

    const entries = [
      // entries only on first and last day (gap in middle)
      ...await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ createdAt: today })).many(2),
      ...await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ createdAt: threeDaysAgo })).many(1)
    ]
    await em.persist(entries).flush()

    const startDate = format(threeDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(4)

    const firstDay = res.body.data[0]
    const gapDay1 = res.body.data[1]
    const gapDay2 = res.body.data[2]
    const lastDay = res.body.data[3]

    expect(firstDay.leaderboards['score']).toBe(1)
    expect(firstDay.change['score']).toBe(1)

    expect(gapDay1.leaderboards['score']).toBeUndefined()
    expect(gapDay1.change['score']).toBe(-1)

    expect(gapDay2.leaderboards['score']).toBeUndefined()
    expect(gapDay2.change['score']).toBe(0)

    expect(lastDay.leaderboards['score']).toBe(2)
    expect(lastDay.change['score']).toBe(2)
  })

  it('should return empty data for a game with no leaderboards', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toStrictEqual([])
    expect(res.body.leaderboardNames).toStrictEqual([])
  })

  it('should include leaderboards with no entries in the date range', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'level' })).one()
    await em.persist(leaderboard).flush()

    const today = new Date()
    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboardNames).toContain('level')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].leaderboards['level']).toBeUndefined()
  })

  it('should not return dev build entries without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'high-scores' })).one()
    const regularPlayer = await new PlayerFactory([game]).one()
    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    await em.persist([leaderboard, regularPlayer, devPlayer]).flush()
    await regularPlayer.aliases.loadItems()
    await devPlayer.aliases.loadItems()

    const today = new Date()

    const entries = [
      ...await new LeaderboardEntryFactory(leaderboard, [regularPlayer]).state(() => ({ createdAt: today })).many(2),
      ...await new LeaderboardEntryFactory(leaderboard, [devPlayer]).state(() => ({ createdAt: today })).many(3)
    ]
    await em.persist(entries).flush()

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].leaderboards['high-scores']).toBe(2)
  })

  it('should return dev build entries with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'high-scores' })).one()
    const regularPlayer = await new PlayerFactory([game]).one()
    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    await em.persist([leaderboard, regularPlayer, devPlayer]).flush()
    await regularPlayer.aliases.loadItems()
    await devPlayer.aliases.loadItems()

    const today = new Date()

    const entries = [
      ...await new LeaderboardEntryFactory(leaderboard, [regularPlayer]).state(() => ({ createdAt: today })).many(2),
      ...await new LeaderboardEntryFactory(leaderboard, [devPlayer]).state(() => ({ createdAt: today })).many(3)
    ]
    await em.persist(entries).flush()

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].leaderboards['high-scores']).toBe(5)
  })

  it('should not return data for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/charts/new-leaderboard-entries')
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return data for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should require the startDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['startDate is missing from the request query']
      }
    })
  })

  it('should require the endDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-leaderboard-entries`)
      .query({ startDate: '2024-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['endDate is missing from the request query']
      }
    })
  })
})
