import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Game stat admin API - find', () => {
  it('should return a stat for a key with the read:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.id).toBe(stat.id)
  })

  it('should return 403 for a key missing the read:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const stat = await new GameStatFactory([apiKey.game]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:stats')
  })

  it('should return 404 for a stat that does not belong to the key game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])
    const [, otherGame] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([otherGame]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should recalculate the global value without the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .global()
      .state(() => ({ globalValue: 50 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 40 }))
      .one()
    await em.persist(playerStat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.globalValue).toBe(40)
  })

  it('should not recalculate the global value with the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .global()
      .state(() => ({ globalValue: 50 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).devBuild().one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 10 }))
      .one()
    await em.persist(playerStat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.stat.globalValue).toBe(50)
  })

  it('should load metrics when withMetrics is set', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .global()
      .state(() => ({ globalValue: 0 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await em.persist([stat, playerStat]).flush()

    const snapshot = new PlayerGameStatSnapshot()
    snapshot.construct(player.aliases[0], playerStat)
    snapshot.change = 5

    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: [snapshot.toInsertable()],
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .query({ withMetrics: '1' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.metrics.globalCount).toBe(1)
  })

  it('should return a stat with no metrics when withMetrics is not set', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game]).global().one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.metrics).toBeUndefined()
  })

  it('should not load metrics for a non-global stat even when withMetrics is set', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game]).state(() => ({ global: false })).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .get(`/admin/v1/game-stats/${stat.id}`)
      .query({ withMetrics: '1' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.metrics).toBeUndefined()
  })
})
