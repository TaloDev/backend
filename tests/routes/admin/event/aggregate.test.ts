import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

const FROM = '2026-01-01T00:00:00.000Z'
const TO = '2026-01-03T23:59:59.999Z'

const JANUARY_FIRST = new Date('2026-01-01T12:00:00.000Z')
const JANUARY_THIRD = new Date('2026-01-03T12:00:00.000Z')

function totalCount(body: { series: { buckets: { count: number }[] }[] }) {
  return body.series
    .flatMap((series) => series.buckets)
    .reduce((sum, bucket) => sum + bucket.count, 0)
}

describe('Event admin API - aggregate', () => {
  it('should return a single series with a null name when no names are given', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state((_event, idx) => ({
        createdAt: idx < 2 ? JANUARY_FIRST : JANUARY_THIRD,
      }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.series).toStrictEqual([
      {
        name: null,
        // gaps are zero-filled inside the requested range
        buckets: [
          { start: '2026-01-01T00:00:00.000Z', end: '2026-01-02T00:00:00.000Z', count: 2 },
          { start: '2026-01-02T00:00:00.000Z', end: '2026-01-03T00:00:00.000Z', count: 0 },
          { start: '2026-01-03T00:00:00.000Z', end: '2026-01-04T00:00:00.000Z', count: 1 },
        ],
      },
    ])
  })

  it('should return one zero-filled series per requested name', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state((_event, idx) => ({
        name: idx === 2 ? 'Item purchased' : 'Level completed',
        createdAt: idx === 2 ? JANUARY_THIRD : JANUARY_FIRST,
      }))
      .many(3)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({
        from: FROM,
        to: TO,
        interval: 'day',
        name: ['Level completed', 'Item purchased'],
      })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.series.map((series: { name: string }) => series.name)).toStrictEqual([
      'Level completed',
      'Item purchased',
    ])
    expect(
      res.body.series[0].buckets.map((bucket: { count: number }) => bucket.count),
    ).toStrictEqual([2, 0, 0])
    expect(
      res.body.series[1].buckets.map((bucket: { count: number }) => bucket.count),
    ).toStrictEqual([0, 0, 1])
  })

  it('should accept a single event name', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day', name: 'Level completed' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.series.map((series: { name: string }) => series.name)).toStrictEqual([
      'Level completed',
    ])
  })

  it('should align week buckets to Monday', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state(() => ({ createdAt: new Date('2026-01-07T12:00:00.000Z') }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: '2026-01-07T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z', interval: 'week' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.series[0].buckets).toStrictEqual([
      { start: '2026-01-05T00:00:00.000Z', end: '2026-01-12T00:00:00.000Z', count: 1 },
    ])
  })

  it('should not count dev build events without the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    await em.persist([player, devPlayer]).flush()

    const events = await new EventFactory([player])
      .state(() => ({ createdAt: JANUARY_FIRST }))
      .many(1)
    const devEvents = await new EventFactory([devPlayer])
      .state(() => ({ createdAt: JANUARY_FIRST }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...devEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(totalCount(res.body)).toBe(1)
  })

  it('should count dev build events with the dev data header', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    await em.persist([player, devPlayer]).flush()

    const events = await new EventFactory([player])
      .state(() => ({ createdAt: JANUARY_FIRST }))
      .many(1)
    const devEvents = await new EventFactory([devPlayer])
      .state(() => ({ createdAt: JANUARY_FIRST }))
      .many(1)

    await clickhouse.insert({
      table: 'events',
      values: [...events, ...devEvents].map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .set('x-talo-include-dev-data', '1')
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(totalCount(res.body)).toBe(2)
  })

  it('should reject a range where to is before from', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: TO, to: FROM, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.to[0]).toContain('after or equal to from')
  })

  it('should reject a window longer than 90 days', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: '2026-06-01T00:00:00.000Z', interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.from[0]).toContain('90 days')
  })

  it('should reject a response with more than 750 buckets', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const names = Array.from({ length: 10 }, (_, idx) => `event-${idx}`)

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: '2026-03-31T00:00:00.000Z', interval: 'day', name: names })
      .auth(keyString, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.interval[0]).toContain('750')
    expect(res.body.errors.interval[0]).toContain('coarser interval')
  })

  it('should cache aggregate responses', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const events = await new EventFactory([player])
      .state(() => ({ createdAt: JANUARY_FIRST }))
      .many(2)

    await clickhouse.insert({
      table: 'events',
      values: [events[0].toInsertable()],
      format: 'JSONEachRow',
    })

    const first = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(totalCount(first.body)).toBe(1)

    // lands after the first response was cached, so the same query is stale
    await clickhouse.insert({
      table: 'events',
      values: [events[1].toInsertable()],
      format: 'JSONEachRow',
    })

    const cached = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(cached.body).toStrictEqual(first.body)
  })

  it('should not share a cached response between named and unfiltered queries', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_EVENTS])

    const named = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day', name: ['one', 'two'] })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    const unfiltered = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(named.body.series.map((series: { name: string }) => series.name)).toStrictEqual([
      'one',
      'two',
    ])
    expect(
      unfiltered.body.series.map((series: { name: string | null }) => series.name),
    ).toStrictEqual([null])
  })

  it('should return 403 for a key missing the read:events scope', async () => {
    const { keyString } = await createAdminAPIKey([])

    const res = await request(app)
      .get('/admin/v1/events/aggregate')
      .query({ from: FROM, to: TO, interval: 'day' })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:events')
  })
})
