import request from 'supertest'
import { subDays, format, startOfDay } from 'date-fns'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'

describe('Chart - stats activity', () => {
  it('should return stat snapshot counts by day', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game]).state(() => ({ name: 'Coins collected' })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()
    const yesterday = subDays(today, 1)
    const twoDaysAgo = subDays(today, 2)

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // 3 snapshots today
        ...Array.from({ length: 3 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.createdAt = today
          return snapshot.toInsertable()
        }),
        // 2 snapshots yesterday
        ...Array.from({ length: 2 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.createdAt = yesterday
          return snapshot.toInsertable()
        }),
        // 1 snapshot two days ago
        ...Array.from({ length: 1 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.createdAt = twoDaysAgo
          return snapshot.toInsertable()
        })
      ],
      format: 'JSONEachRow'
    })

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.statNames).toContain('Coins collected')
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

    expect(twoDaysAgoData.stats['Coins collected']).toBe(1)
    expect(twoDaysAgoData.change['Coins collected']).toBe(1)
    expect(yesterdayData.stats['Coins collected']).toBe(2)
    expect(yesterdayData.change['Coins collected']).toBe(1)
    expect(todayData.stats['Coins collected']).toBe(3)
    expect(todayData.change['Coins collected']).toBe(0.5)
  })

  it('should return counts for multiple stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat1 = await new GameStatFactory([game]).state(() => ({ name: 'Kills' })).one()
    const stat2 = await new GameStatFactory([game]).state(() => ({ name: 'Deaths' })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat1 = await new PlayerGameStatFactory().construct(player, stat1).one()
    const playerStat2 = await new PlayerGameStatFactory().construct(player, stat2).one()
    await em.persist([playerStat1, playerStat2]).flush()

    const today = new Date()

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // 5 snapshots for stat1
        ...Array.from({ length: 5 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat1)
          snapshot.createdAt = today
          return snapshot.toInsertable()
        }),
        // 3 snapshots for stat2
        ...Array.from({ length: 3 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat2)
          snapshot.createdAt = today
          return snapshot.toInsertable()
        })
      ],
      format: 'JSONEachRow'
    })

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.statNames).toContain('Kills')
    expect(res.body.statNames).toContain('Deaths')
    expect(res.body.data[0].stats['Kills']).toBe(5)
    expect(res.body.data[0].stats['Deaths']).toBe(3)
  })

  it('should fill gaps with zero counts', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game]).state(() => ({ name: 'Score' })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()
    const threeDaysAgo = subDays(today, 3)

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // Snapshots only on first and last day (gap in middle)
        ...Array.from({ length: 2 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.createdAt = today
          return snapshot.toInsertable()
        }),
        ...Array.from({ length: 1 }, () => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.createdAt = threeDaysAgo
          return snapshot.toInsertable()
        })
      ],
      format: 'JSONEachRow'
    })

    const startDate = format(threeDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(4)

    const gapDay1 = res.body.data[1]
    const gapDay2 = res.body.data[2]

    expect(gapDay1.stats['Score']).toBeUndefined()
    expect(gapDay2.stats['Score']).toBeUndefined()
  })

  it('should return empty stats for a game with no stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toStrictEqual([])
    expect(res.body.statNames).toStrictEqual([])
  })

  it('should include stats with no snapshots in the date range', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game]).state(() => ({ name: 'Level' })).one()
    await em.persist(stat).flush()

    const today = new Date()
    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.statNames).toContain('Level')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].stats['Level']).toBeUndefined()
  })

  it('should not return stat counts for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/charts/stats-activity')
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return stat counts for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should require startDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/stats-activity`)
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
      .get(`/games/${game.id}/charts/stats-activity`)
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
