import request from 'supertest'
import { subDays, format, startOfDay } from 'date-fns'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Chart - new players', () => {
  it('should return player counts by day', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()
    const yesterday = subDays(today, 1)
    const twoDaysAgo = subDays(today, 2)

    const playersToday = await new PlayerFactory([game]).state(() => ({
      createdAt: today
    })).many(3)

    const playersYesterday = await new PlayerFactory([game]).state(() => ({
      createdAt: yesterday
    })).many(2)

    const playersTwoDaysAgo = await new PlayerFactory([game]).state(() => ({
      createdAt: twoDaysAgo
    })).many(1)

    await em.persist([...playersToday, ...playersYesterday, ...playersTwoDaysAgo]).flush()

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

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

    expect(twoDaysAgoData.count).toBe(1)
    expect(yesterdayData.count).toBe(2)
    expect(todayData.count).toBe(3)
  })

  it('should fill gaps with zero counts', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()
    const threeDaysAgo = subDays(today, 3)

    const playersToday = await new PlayerFactory([game]).state(() => ({
      createdAt: today
    })).many(2)

    const playersThreeDaysAgo = await new PlayerFactory([game]).state(() => ({
      createdAt: threeDaysAgo
    })).many(1)

    await em.persist([...playersToday, ...playersThreeDaysAgo]).flush()

    const startDate = format(threeDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(4)

    const gapDay1 = res.body.data[1]
    const gapDay2 = res.body.data[2]

    expect(gapDay1.count).toBe(0)
    expect(gapDay2.count).toBe(0)
  })

  it('should not return player counts for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/charts/new-players')
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return player counts for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not return dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()

    const regularPlayers = await new PlayerFactory([game]).state(() => ({
      createdAt: today
    })).many(2)

    const devPlayers = await new PlayerFactory([game]).devBuild().state(() => ({
      createdAt: today
    })).many(3)

    await em.persist([...regularPlayers, ...devPlayers]).flush()

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].count).toBe(2)
  })

  it('should return dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()

    const regularPlayers = await new PlayerFactory([game]).state(() => ({
      createdAt: today
    })).many(2)

    const devPlayers = await new PlayerFactory([game]).devBuild().state(() => ({
      createdAt: today
    })).many(3)

    await em.persist([...regularPlayers, ...devPlayers]).flush()

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].count).toBe(5)
  })

  it('should require startDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['startDate is missing from the request query']
      }
    })
  })

  it('should require endDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate: '2024-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['endDate is missing from the request query']
      }
    })
  })

  it('should reject if startDate is after endDate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate: '2024-01-07', endDate: '2024-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['Invalid start date, it should be before the end date']
      }
    })
  })

  it('should calculate change between days', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()
    const yesterday = subDays(today, 1)
    const twoDaysAgo = subDays(today, 2)

    const playersTwoDaysAgo = await new PlayerFactory([game]).state(() => ({
      createdAt: twoDaysAgo
    })).many(2)

    const playersYesterday = await new PlayerFactory([game]).state(() => ({
      createdAt: yesterday
    })).many(4)

    const playersToday = await new PlayerFactory([game]).state(() => ({
      createdAt: today
    })).many(3)

    await em.persist([...playersTwoDaysAgo, ...playersYesterday, ...playersToday]).flush()

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

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

    // two days ago: change equals count when prev is 0
    expect(twoDaysAgoData.change).toBe(2)
    // one day ago: (4 - 2) / 2 = 1 (100% increase)
    expect(yesterdayData.change).toBe(1)
    // today: (3 - 4) / 4 = -0.25 (25% decrease)
    expect(todayData.change).toBe(-0.25)
  })

  it('should return zero change for gap days with zero previous count', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()
    const twoDaysAgo = subDays(today, 2)

    const playersTwoDaysAgo = await new PlayerFactory([game]).state(() => ({
      createdAt: twoDaysAgo
    })).many(2)

    await em.persist(playersTwoDaysAgo).flush()

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(3)

    // first day has data
    expect(res.body.data[0].count).toBe(2)
    expect(res.body.data[0].change).toBe(2)

    // gap day: count is 0, change is (0 - 2) / 2 = -1
    expect(res.body.data[1].count).toBe(0)
    expect(res.body.data[1].change).toBe(-1)

    // last day: count is 0, prev was 0, so change is 0
    expect(res.body.data[2].count).toBe(0)
    expect(res.body.data[2].change).toBe(0)
  })

  it('should return an empty list when there are no players for the data range', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const today = new Date()
    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/new-players`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(0)
  })
})
