import {
  deleteEventPropsByIds,
  deleteEventPropsWhere,
} from '../../../src/lib/clickhouse/deleteEventProps.js'
import EventFactory from '../../fixtures/EventFactory.js'
import GameFactory from '../../fixtures/GameFactory.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'

describe('deleteEventPropsByIds', () => {
  it('should delete all props across chunks', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).many(7)
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

    // chunk size 3 with 7 events forces three deletes
    await deleteEventPropsByIds({
      clickhouse,
      eventIds: events.map((event) => event.id),
      chunkSize: 3,
    })

    await vi.waitUntil(async () => {
      const remainingProps = await clickhouse
        .query({ query: 'SELECT count() AS count FROM event_props', format: 'JSONEachRow' })
        .then((res) => res.json<{ count: string }>())

      return Number(remainingProps[0].count) === 0
    })

    const remainingEvents = await clickhouse
      .query({ query: 'SELECT count() AS count FROM events', format: 'JSONEachRow' })
      .then((res) => res.json<{ count: string }>())

    expect(Number(remainingEvents[0].count)).toBe(7)
  })

  it('should delete props across pages', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()

    const player = await new PlayerFactory([game]).one()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(player).flush()
    await em.persist(otherPlayer).flush()

    const events = await new EventFactory([player]).many(7)
    const otherEvents = await new EventFactory([otherPlayer]).many(2)
    const seeded = [...events, ...otherEvents]

    await clickhouse.insert({
      table: 'events',
      values: seeded.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: seeded.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    // page size 3 with 7 matching events forces three pages
    await deleteEventPropsWhere({
      clickhouse,
      where: 'game_id = {gameId:UInt32}',
      params: { gameId: game.id },
      pageSize: 3,
    })

    const expectedProps = otherEvents.flatMap((event) => event.getInsertableProps()).length

    await vi.waitUntil(async () => {
      const remainingProps = await clickhouse
        .query({
          query: 'SELECT count() AS count FROM event_props',
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())

      return Number(remainingProps[0].count) === expectedProps
    })

    const remainingProps = await clickhouse
      .query({
        query: 'SELECT count() AS count FROM event_props',
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())

    // only the other game's props remain
    expect(Number(remainingProps[0].count)).toBe(expectedProps)
  })
})
