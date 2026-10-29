import { addDays, addHours } from 'date-fns'
import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import Prop from '../../../../src/entities/prop.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

const FROM = '2026-01-01T00:00:00.000Z'
const TO = '2026-01-31T23:59:59.999Z'
const START = new Date('2026-01-01T00:00:00.000Z')

describe('Event admin API - list', () => {
  it('should return raw events oldest first for a key with the read:events scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state((_event, idx) => ({ name: 'Level completed', createdAt: addDays(START, idx) }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(3)
    expect(res.body.events.map((event: { id: string }) => event.id)).toStrictEqual(
      events.map((event) => event.id),
    )
    expect(res.body.events[0]).toStrictEqual({
      id: events[0].id,
      name: 'Level completed',
      playerAliasId: events[0].playerAlias.id,
      devBuild: false,
      createdAt: events[0].createdAt.toISOString(),
    })
    expect(res.body.nextCursor).toBeNull()
  })

  it('should return 403 for a key missing the read:events scope', async () => {
    const { keyString } = await createAdminAPIKey([])

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:events')
  })

  it('should reject a window longer than 90 days', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: '2026-06-01T00:00:00.000Z' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.from[0]).toContain('90 days')
  })

  it('should not return dev build events without the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    await em.persist([player, devPlayer]).flush()

    const events = await new EventFactory([player]).state(() => ({ createdAt: START })).many(1)
    const devEvents = await new EventFactory([devPlayer])
      .state(() => ({ createdAt: START }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...devEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0].id).toBe(events[0].id)
  })

  it('should return dev build events with the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    await em.persist([player, devPlayer]).flush()

    const events = await new EventFactory([player]).state(() => ({ createdAt: START })).many(1)
    const devEvents = await new EventFactory([devPlayer])
      .state(() => ({ createdAt: START }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...devEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO })
      .set('x-talo-include-dev-data', '1')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.events).toHaveLength(2)
  })

  it('should never return events from another game', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])
    const [, otherGame] = await createOrganisationAndGame()

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist([player, otherPlayer]).flush()

    const ownEvents = await new EventFactory([player]).state(() => ({ createdAt: START })).many(1)
    const otherEvents = await new EventFactory([otherPlayer])
      .state(() => ({ createdAt: START }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: [...ownEvents, ...otherEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, includeProps: '1' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.events.map((event: { id: string }) => event.id)).toStrictEqual([
      ownEvents[0].id,
    ])
  })

  it('should omit props by default and include them on request', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).state(() => ({ createdAt: START })).many(1)
    events[0].setProps([new Prop('level', '3')])

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

    const withoutProps = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(withoutProps.body.events[0].props).toBeUndefined()

    const withProps = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, includeProps: '1' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(withProps.body.events[0].props).toStrictEqual([{ key: 'level', value: '3' }])
  })

  it('should page through events with a cursor', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state((_event, idx) => ({ createdAt: addHours(START, idx) }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const firstPage = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, limit: 2 })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(firstPage.body.events).toHaveLength(2)
    expect(firstPage.body.nextCursor).toBeTruthy()

    const secondPage = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, limit: 2, cursor: firstPage.body.nextCursor })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(secondPage.body.events).toHaveLength(1)
    expect(secondPage.body.events[0].id).toBe(events[2].id)
    expect(secondPage.body.nextCursor).toBeNull()
  })

  it('should reject an invalid cursor', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, cursor: 'not-a-cursor' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.message).toContain('Invalid cursor')
  })

  it('should reject a range where to is before from', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: TO, to: FROM })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.to[0]).toContain('after or equal to from')
  })

  it('should only report the invalid date fields', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events')
      .query({ from: 'nope', to: 'nope' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors).toStrictEqual({
      from: ['Invalid from date, please use YYYY-MM-DD or a timestamp'],
      to: ['Invalid to date, please use YYYY-MM-DD or a timestamp'],
    })
  })

  it('should not skip or repeat events that share a created_at when paging', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player]).state(() => ({ createdAt: START })).many(3)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const first = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, limit: 2 })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    const second = await request(app)
      .get('/admin/v1/events')
      .query({ from: FROM, to: TO, limit: 2, cursor: first.body.nextCursor })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    const seen = [...first.body.events, ...second.body.events].map(
      (event: { id: string }) => event.id,
    )

    expect(seen).toHaveLength(events.length)
    expect(new Set(seen)).toStrictEqual(new Set(events.map((event) => event.id)))
    expect(second.body.nextCursor).toBeNull()
  })
})
