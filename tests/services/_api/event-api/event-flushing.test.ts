import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import Event, { ClickHouseEvent } from '../../../../src/entities/event'
import { FlushEventsQueueHandler } from '../../../../src/lib/queues/game-metrics/flush-events-queue-handler'
import Redis from 'ioredis'

describe('Events API service - event flushing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should flush events', async () => {
    const consoleSpy = vi.spyOn(console, 'info')

    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]
    const handler = new FlushEventsQueueHandler()

    const event1 = new Event().construct('Craft bow', apiKey.game)
    event1.playerAlias = alias
    event1.createdAt = new Date()

    const event2 = new Event().construct('Shoot bow', apiKey.game)
    event2.playerAlias = alias
    event2.createdAt = new Date()
    event2.setProps([{ key: 'type', value: 'quick' }, { key: 'damage', value: '8' }])

    await handler.add(event1)
    await handler.add(event2)

    await handler.handle()
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockClear()

    await vi.waitUntil(async () => {
      const events = await clickhouse.query({
        query: `SELECT * FROM events WHERE game_id = ${apiKey.game.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHouseEvent>())

      const props = await clickhouse.query({
        query: 'SELECT * FROM event_props',
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHouseEvent>())

      return events.length === 2 && props.length == 2
    })

    // nothing to flush
    await handler.handle()
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('should still flush events if redis fails', async () => {
    const consoleSpy = vi.spyOn(console, 'info')

    const error = new Error('Something went wrong')
    vi.spyOn(Redis.prototype, 'pipeline').mockImplementation(() => {
      throw new Error()
    })
    vi.spyOn(Redis.prototype, 'hgetall').mockRejectedValue(error)
    vi.spyOn(Redis.prototype, 'hdel').mockRejectedValue(error)

    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.WRITE_EVENTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]
    const handler = new FlushEventsQueueHandler()

    const event1 = new Event().construct('Craft bow', apiKey.game)
    event1.playerAlias = alias
    event1.createdAt = new Date()
    await handler.add(event1)

    await handler.handle()
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockClear()

    await vi.waitUntil(async () => {
      const events = await clickhouse.query({
        query: `SELECT * FROM events WHERE game_id = ${apiKey.game.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHouseEvent>())

      return events.length === 1
    })

    // nothing to flush
    await handler.handle()
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
