import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Game from '../../../../src/entities/game'
import { subHours } from 'date-fns'
import PlayerGameStatSnapshot from '../../../../src/entities/player-game-stat-snapshot'
import { FlushStatSnapshotsQueueHandler } from '../../../../src/lib/queues/game-metrics/flush-stat-snapshots-queue-handler'

describe('Game stats API service - put', () => {
  const createStat = async (game: Game, props: Partial<GameStat>) => {
    const stat = await new GameStatFactory([game]).state(() => ({ ...props })).one()
    em.persist(stat)

    return stat
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a player stat if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)
  })

  it('should not create a player stat if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not create a player stat for a missing player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '12345')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a player stat if the last update was less than the min time between updates', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minTimeBetweenUpdates: 30 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat cannot be updated more often than every 30 seconds' })
  })

  it('should not create a player stat if the change is greater than the max change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 100 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat change cannot be more than 99' })
  })

  it('should create a player stat if there is no max change', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, defaultValue: 1, maxChange: null })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 998 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value below the min value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minValue: -1, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: -2 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go below the minValue of -1' })
  })

  it('should create a player stat if there is no min value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, minValue: null, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: -99 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value above the max value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxChange: 99, maxValue: 3, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 4 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go above the maxValue of 3' })
  })

  it('should create a player stat if there is no max value', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: null, maxChange: 99, defaultValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 99 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)
  })

  it('should update an existing player stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: false })
    const player = await new PlayerFactory([apiKey.game]).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 10, createdAt: new Date(2021, 1, 1) }))
      .one()
    await em.persistAndFlush(playerStat)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.playerStat.value).toBe(60)
  })

  it('should increment global stats', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.playerStat.value).toBe(50)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(50)
  })

  it('should not update a non-existent stat', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .put('/v1/game-stats/blah')
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should set the createdAt of the player stat to the continuity date', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS, APIKeyScope.WRITE_CONTINUITY_REQUESTS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const continuityDate = subHours(new Date(), 1)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(res.body.playerStat.createdAt).toBe(continuityDate.toISOString())
  })

  it('should create a player game stat snapshot', async () => {
    const addSpy = vi.spyOn(FlushStatSnapshotsQueueHandler.prototype, 'add')

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(addSpy).toHaveBeenCalledOnce()
    const [arg]: [PlayerGameStatSnapshot] = addSpy.mock.calls[0]
    const insertable = arg.toInsertable()

    expect(insertable.change).toBe(50)
    expect(insertable.value).toBe(50)
    expect(insertable.global_value).toBe(50)
  })

  it('should create a player game stat snapshot with the continuity date', async () => {
    const addSpy = vi.spyOn(FlushStatSnapshotsQueueHandler.prototype, 'add')

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS, APIKeyScope.WRITE_CONTINUITY_REQUESTS])
    const stat = await createStat(apiKey.game, { maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const continuityDate = subHours(new Date(), 1)

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 50 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(addSpy).toHaveBeenCalledOnce()
    const [arg]: [PlayerGameStatSnapshot] = addSpy.mock.calls[0]
    const insertable = arg.toInsertable()

    expect(insertable.change).toBe(50)
    expect(insertable.value).toBe(50)
    expect(insertable.global_value).toBe(50)

    const date = new Date(insertable.created_at)
    expect(date.toISOString()).toBe(continuityDate.toISOString())
  })
})
