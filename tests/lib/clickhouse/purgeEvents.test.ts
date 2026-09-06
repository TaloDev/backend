import { sub } from 'date-fns'
import { purgeEvents } from '../../../src/lib/clickhouse/purgeEvents.js'
import EventFactory from '../../fixtures/EventFactory.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'

async function countRows(table: 'events' | 'event_props') {
  const rows = await clickhouse
    .query({ query: `SELECT count() AS count FROM ${table}`, format: 'JSONEachRow' })
    .then((res) => res.json<{ count: string }>())

  return Number(rows[0].count)
}

describe('purgeEvents', () => {
  it('should purge props across multiple pages', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: sub(new Date(), { minutes: 30 }) }))
      .many(7)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    // page size 3 with 7 events forces three pages through the (created_at, id) cursor
    const purged = await purgeEvents({
      clickhouse,
      gameId: game.id,
      eventName: 'Open inventory',
      pageSize: 3,
    })

    expect(purged).toBe(7)

    await vi.waitUntil(async () => (await countRows('events')) === 0)
    await vi.waitUntil(async () => (await countRows('event_props')) === 0)
  })

  it('should purge events sharing an identical created_at', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const createdAt = new Date()
    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt }))
      .many(5)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    // identical timestamps force the id tie-break on every page boundary
    const purged = await purgeEvents({
      clickhouse,
      gameId: game.id,
      eventName: 'Open inventory',
      pageSize: 2,
    })

    expect(purged).toBe(5)

    await vi.waitUntil(async () => (await countRows('events')) === 0)
    await vi.waitUntil(async () => (await countRows('event_props')) === 0)
  })

  it('should purge an exact multiple of the page size', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state(() => ({ name: 'Open inventory', createdAt: sub(new Date(), { minutes: 30 }) }))
      .many(6)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    const purged = await purgeEvents({
      clickhouse,
      gameId: game.id,
      eventName: 'Open inventory',
      pageSize: 3,
    })

    expect(purged).toBe(6)

    await vi.waitUntil(async () => (await countRows('events')) === 0)
    await vi.waitUntil(async () => (await countRows('event_props')) === 0)
  })
})
