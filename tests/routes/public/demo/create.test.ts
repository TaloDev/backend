import { sub } from 'date-fns'
import request from 'supertest'
import Organisation from '../../../../src/entities/organisation'
import User, { UserType } from '../../../../src/entities/user'
import { formatDateForClickHouse } from '../../../../src/lib/clickhouse/formatDateTime'
import randomDate from '../../../../src/lib/dates/randomDate'
import EventFactory from '../../../fixtures/EventFactory'
import GameFactory from '../../../fixtures/GameFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'

describe('Demo - create', () => {
  let demoOrg: Organisation

  beforeAll(async () => {
    demoOrg = await new OrganisationFactory().demo().one()
    await em.persist(demoOrg).flush()
  })

  it('should create a demo user and then delete them', async () => {
    const res = await request(app).post('/public/demo').expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation.id).toBe(demoOrg.id)
    expect(res.body.user.type).toBe(UserType.DEMO)

    expect(res.body.accessToken).toBeTruthy()

    const user = await em.getRepository(User).findOne(res.body.user.id)
    expect(user).toBeNull()
  })

  it('should insert events if there arent any for the last month', async () => {
    const game = await new GameFactory(demoOrg).one()
    const players = await new PlayerFactory([game]).many(2)
    await em.persist(players).flush()

    const date = formatDateForClickHouse(sub(new Date(), { months: 1 }))

    let eventsThisMonth = await clickhouse
      .query({
        query: `SELECT count() as count FROM events WHERE game_id = ${game.id} AND created_at >= '${date}'`,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())
      .then((res) => Number(res[0].count))

    expect(eventsThisMonth).toEqual(0)

    const randomEvents = await new EventFactory(players)
      .state(() => ({
        createdAt: randomDate(sub(new Date(), { years: 1 }), sub(new Date(), { months: 2 })),
      }))
      .many(20)
    await clickhouse.insert({
      table: 'events',
      values: randomEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    await request(app).post('/public/demo').expect(200)

    eventsThisMonth = await clickhouse
      .query({
        query: `SELECT count() as count FROM events WHERE game_id = ${game.id} AND created_at >= '${date}'`,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())
      .then((res) => Number(res[0].count))

    expect(eventsThisMonth).toBeGreaterThan(0)
  })
})
