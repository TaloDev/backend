import request from 'supertest'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createUserAndToken from '../../../utils/createUserAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'

describe('Game stat  - index', () => {
  it('should return a list of game stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stats = await new GameStatFactory([game]).many(3)
    await em.persistAndFlush([game, ...stats])

    const res = await request(app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(stats.length)
  })

  it('should not return a list of game stats for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const stats = await new GameStatFactory([game]).many(3)
    await em.persistAndFlush([game, ...stats])

    await request(app)
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

    await em.persistAndFlush([playerStat, otherPlayerStat])

    const res = await request(app)
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
    await em.persistAndFlush(playerStat)

    const res = await request(app)
      .get(`/games/${game.id}/game-stats`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.stats[0].globalValue).toBe(50)
  })

  it('should load metrics filtered by startDate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 0 })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush([stat, player])

    const values: [Date, number][] = [
      [new Date('2025-06-09T09:00:00.000Z'), 1],
      [new Date('2025-06-10T09:00:00.000Z'), 5],
      [new Date('2025-06-11T09:00:00.000Z'), 7]
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(values.map(async ([date, value]) => {
        const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value })).one()
        await em.persistAndFlush(playerStat)
        stat.globalValue += value

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = value
        snapshot.createdAt = date

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/game-stats`)
      .query({ withMetrics: '1', metricsStartDate: values[1][0].toISOString() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // only changes from the last 2 dates
    expect(res.body.stats[0].metrics.globalCount).toBe(2)
    expect(res.body.stats[0].metrics.globalValue.minValue).toBe(5)
    expect(res.body.stats[0].metrics.globalValue.maxValue).toBe(12)
    expect(res.body.stats[0].metrics.playerValue.minValue).toBe(5)
    expect(res.body.stats[0].metrics.playerValue.maxValue).toBe(7)
  })

  it('should load metrics filtered by endDate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 0 })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush([stat, player])

    const values: [Date, number][] = [
      [new Date('2025-06-09T09:00:00.000Z'), 1],
      [new Date('2025-06-10T09:00:00.000Z'), 5],
      [new Date('2025-06-11T09:00:00.000Z'), 7]
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(values.map(async ([date, value]) => {
        const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value })).one()
        await em.persistAndFlush(playerStat)
        stat.globalValue += value

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = value
        snapshot.createdAt = date

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/game-stats`)
      .query({ withMetrics: '1', metricsEndDate: values[1][0].toISOString() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // only changes from the first 2 dates
    expect(res.body.stats[0].metrics.globalCount).toBe(2)
    expect(res.body.stats[0].metrics.globalValue.minValue).toBe(5)
    expect(res.body.stats[0].metrics.globalValue.maxValue).toBe(13)
    expect(res.body.stats[0].metrics.playerValue.minValue).toBe(1)
    expect(res.body.stats[0].metrics.playerValue.maxValue).toBe(5)
  })

  it('should load metrics filtered by both startDate and endDate', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 0 })).one()
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush([stat, player])

    const values: [Date, number][] = [
      [new Date('2025-06-09T09:00:00.000Z'), 1],
      [new Date('2025-06-10T09:00:00.000Z'), 5],
      [new Date('2025-06-11T09:00:00.000Z'), 7]
    ]

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: await Promise.all(values.map(async ([date, value]) => {
        const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value })).one()
        await em.persistAndFlush(playerStat)
        stat.globalValue += value

        const snapshot = new PlayerGameStatSnapshot()
        snapshot.construct(playerStat.player.aliases[0], playerStat)
        snapshot.change = value
        snapshot.createdAt = date

        return snapshot.toInsertable()
      })),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/game-stats`)
      .query({
        withMetrics: '1',
        metricsStartDate: '2025-06-10',
        metricsEndDate: '2025-06-10'
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // only changes from the middle date
    expect(res.body.stats[0].metrics.globalCount).toBe(1)
    expect(res.body.stats[0].metrics.globalValue.minValue).toBe(5)
    expect(res.body.stats[0].metrics.globalValue.maxValue).toBe(5)
    expect(res.body.stats[0].metrics.playerValue.minValue).toBe(5)
    expect(res.body.stats[0].metrics.playerValue.maxValue).toBe(5)
  })
})
