import { subDays, format, startOfDay, addMinutes } from 'date-fns'
import request from 'supertest'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Chart - stats global value', () => {
  it('should return global values by day', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({
        internalName: 'total-coins',
        name: 'Total coins',
        global: true,
        globalValue: 100,
        defaultValue: 0,
      }))
      .one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()
    const yesterday = subDays(today, 1)
    const twoDaysAgo = subDays(today, 2)

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // today: global value reaches 100
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 100
          snapshot.createdAt = today
          return snapshot.toInsertable()
        })(),
        // yesterday: global value was 75
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 75
          snapshot.createdAt = yesterday
          return snapshot.toInsertable()
        })(),
        // two days ago: global value was 50
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 50
          snapshot.createdAt = twoDaysAgo
          return snapshot.toInsertable()
        })(),
      ],
      format: 'JSONEachRow',
    })

    const startDate = format(twoDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/total-coins`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('total-coins')
    expect(res.body.data).toHaveLength(3)

    const twoDaysAgoData = res.body.data.find(
      (d: { date: number }) => d.date === startOfDay(twoDaysAgo).getTime(),
    )
    const yesterdayData = res.body.data.find(
      (d: { date: number }) => d.date === startOfDay(yesterday).getTime(),
    )
    const todayData = res.body.data.find(
      (d: { date: number }) => d.date === startOfDay(today).getTime(),
    )

    expect(twoDaysAgoData.value).toBe(50)
    expect(twoDaysAgoData.change).toBe(50)
    expect(yesterdayData.value).toBe(75)
    expect(yesterdayData.change).toBe(0.5)
    expect(todayData.value).toBe(100)
    expect(todayData.change).toBeCloseTo(0.333, 2)
  })

  it('should return the latest global value when multiple snapshots exist on the same day', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({
        internalName: 'total-kills',
        name: 'Total kills',
        global: true,
        globalValue: 150,
      }))
      .one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // Multiple snapshots on the same day - latest timestamp has the lower value
        // This distinguishes argMax (picks by latest time) from max (picks highest value)
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 100
          snapshot.createdAt = today
          return snapshot.toInsertable()
        })(),
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 200
          snapshot.createdAt = addMinutes(today, 10)
          return snapshot.toInsertable()
        })(),
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 150
          snapshot.createdAt = addMinutes(today, 20)
          return snapshot.toInsertable()
        })(),
      ],
      format: 'JSONEachRow',
    })

    const startDate = format(today, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/total-kills`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // argMax returns 150 (latest by time)
    expect(res.body.data[0].value).toBe(150)
  })

  it('should fill gaps with previous day values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({
        internalName: 'total-score',
        name: 'Total score',
        global: true,
        globalValue: 300,
      }))
      .one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()
    const threeDaysAgo = subDays(today, 3)

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        // snapshots only on first and last day (gap in middle)
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 300
          snapshot.createdAt = today
          return snapshot.toInsertable()
        })(),
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 100
          snapshot.createdAt = threeDaysAgo
          return snapshot.toInsertable()
        })(),
      ],
      format: 'JSONEachRow',
    })

    const startDate = format(threeDaysAgo, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/total-score`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(4)

    // gap days should carry forward the previous value
    expect(res.body.data[0].value).toBe(100)
    expect(res.body.data[1].value).toBe(100)
    expect(res.body.data[2].value).toBe(100)
    expect(res.body.data[3].value).toBe(300)
  })

  it('should use the stat defaultValue as the starting point', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({
        internalName: 'total-xp',
        name: 'Total XP',
        global: true,
        globalValue: 150,
        defaultValue: 100,
      }))
      .one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist(playerStat).flush()

    const today = new Date()
    const yesterday = subDays(today, 1)

    // only insert a snapshot for today, not yesterday
    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [
        (() => {
          const snapshot = new PlayerGameStatSnapshot()
          snapshot.construct(player.aliases[0], playerStat)
          snapshot.globalValue = 150
          snapshot.createdAt = today
          return snapshot.toInsertable()
        })(),
      ],
      format: 'JSONEachRow',
    })

    const startDate = format(yesterday, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/total-xp`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(2)

    // yesterday should use defaultValue (100) since no snapshot exists
    expect(res.body.data[0].value).toBe(100)
    expect(res.body.data[0].change).toBe(0)

    // today has snapshot with value 150, change from 100 is 0.5
    expect(res.body.data[1].value).toBe(150)
    expect(res.body.data[1].change).toBe(0.5)
  })

  it('should use the default value when there are no snapshots', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({
        internalName: 'total-gold',
        name: 'Total gold',
        global: true,
        globalValue: 0,
        defaultValue: 50,
      }))
      .one()
    await em.persist(stat).flush()

    const today = new Date()
    const yesterday = subDays(today, 1)

    const startDate = format(yesterday, 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/total-gold`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.data).toHaveLength(2)

    // both days should use defaultValue since no snapshots exist
    expect(res.body.data[0].value).toBe(50)
    expect(res.body.data[0].change).toBe(0)
    expect(res.body.data[1].value).toBe(50)
    expect(res.body.data[1].change).toBe(0)
  })

  it('should return 404 for a non-global stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const stat = await new GameStatFactory([game])
      .state(() => ({ internalName: 'local-stat', name: 'Local stat', global: false }))
      .one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/local-stat`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should return 404 for a non-existent stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/non-existent`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should not return data for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/charts/global-stats/some-stat')
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return data for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/charts/global-stats/some-stat`)
      .query({ startDate: '2024-01-01', endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should require the startDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/some-stat`)
      .query({ endDate: '2024-01-07' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        startDate: ['startDate is missing from the request query'],
      },
    })
  })

  it('should require the endDate query parameter', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const res = await request(app)
      .get(`/games/${game.id}/charts/global-stats/some-stat`)
      .query({ startDate: '2024-01-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        endDate: ['endDate is missing from the request query'],
      },
    })
  })
})
