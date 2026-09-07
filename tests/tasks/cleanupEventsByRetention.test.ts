import { subDays } from 'date-fns'
import EventRetention from '../../src/entities/event-retention.js'
import { cleanupEventsByRetention } from '../../src/tasks/cleanupEventsByRetention.js'
import EventFactory from '../fixtures/EventFactory.js'
import GameFactory from '../fixtures/GameFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('cleanupEventsByRetention', () => {
  it('should delete events and props past their retention period', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    await em.persist(new EventRetention(game, 'Open inventory', 30)).flush()

    const oldEvents = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 40) }))
      .many(2)
    const recentEvents = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory' }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: [...oldEvents, ...recentEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: [...oldEvents, ...recentEvents].flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    await cleanupEventsByRetention()

    const remaining = await clickhouse
      .query({
        query: 'SELECT name, created_at FROM events ORDER BY created_at',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ name: string; created_at: string }>())

    expect(remaining).toHaveLength(1)
    expect(remaining[0].name).toBe('Open inventory')
    expect(remaining[0].created_at).toBe(recentEvents[0].toInsertable().created_at)

    const remainingProps = await clickhouse
      .query({
        query: 'SELECT event_id FROM event_props',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ event_id: string }>())

    expect(remainingProps.map((prop) => prop.event_id)).toStrictEqual([recentEvents[0].id])
  })

  it('should not touch events without a retention config', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 400) }))
      .many(2)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    await cleanupEventsByRetention()

    const remaining = await clickhouse
      .query({
        query: 'SELECT count() AS count FROM events',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())

    expect(Number(remaining[0].count)).toBe(2)
  })

  it("should not touch another game's events with the same name", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()

    const player = await new PlayerFactory([game]).one()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(player).flush()
    await em.persist(otherPlayer).flush()

    await em.persist(new EventRetention(game, 'Open inventory', 30)).flush()

    const otherEvents = await new EventFactory([otherPlayer])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 400) }))
      .many(2)

    await clickhouse.insert({
      table: 'events',
      values: otherEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    await cleanupEventsByRetention()

    const remaining = await clickhouse
      .query({
        query: 'SELECT count() AS count FROM events',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())

    expect(Number(remaining[0].count)).toBe(2)
  })

  it('should keep purging other games when one purge fails', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()

    const player = await new PlayerFactory([game]).one()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(player).flush()
    await em.persist(otherPlayer).flush()

    // absurd retentionDays makes the cutoff an invalid date, which ClickHouse
    // refuses to parse as a DateTime64 param and the purge throws
    await em.persist(new EventRetention(game, 'Open inventory', 2_000_000_000)).flush()
    await em.persist(new EventRetention(otherGame, 'Open inventory', 30)).flush()

    const failingEvents = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 40) }))
      .many(2)
    const purgedEvents = await new EventFactory([otherPlayer])
      .state(() => ({ name: 'Open inventory', createdAt: subDays(new Date(), 40) }))
      .many(2)

    await clickhouse.insert({
      table: 'events',
      values: [...failingEvents, ...purgedEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    await cleanupEventsByRetention()

    const remaining = await clickhouse
      .query({
        query: 'SELECT game_id, count() AS count FROM events GROUP BY game_id',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ game_id: number; count: string }>())

    expect(remaining).toStrictEqual([{ game_id: game.id, count: '2' }])
  })
})
