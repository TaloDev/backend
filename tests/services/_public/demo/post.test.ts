import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import Organisation from '../../../../src/entities/organisation'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import User, { UserType } from '../../../../src/entities/user'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameFactory from '../../../fixtures/GameFactory'
import { sub } from 'date-fns'
import Event from '../../../../src/entities/event'

const baseUrl = '/public/demo'

describe('Demo service - post', () => {
  let app: Koa
  let demoOrg: Organisation

  beforeAll(async () => {
    app = await init()

    demoOrg = await new OrganisationFactory().state('demo').one()
    await (<EntityManager>app.context.em).getRepository(Organisation).persistAndFlush(demoOrg)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a demo user and then delete them', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation.id).toBe(demoOrg.id)
    expect(res.body.user.type).toBe(UserType.DEMO)

    expect(res.body.accessToken).toBeTruthy()

    const user = await (<EntityManager>app.context.em).getRepository(User).findOne(res.body.user.id)
    expect(user).toBeNull()
  })

  it('should update the createdAt of events older than 3 months', async () => {
    const game = await new GameFactory(demoOrg).one()
    const players = await new PlayerFactory([game]).many(2)
    const events = await new EventFactory(players).state('this year').many(20)
    await (<EntityManager>app.context.em).persistAndFlush(events)

    let oldEvents = events.filter((event) => event.createdAt < sub(new Date(), { months: 3 }))
    expect(oldEvents.length).toBeGreaterThan(0)
 
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .expect(200)

    await (<EntityManager>app.context.em).clear()

    const updatedEvents = await (<EntityManager>app.context.em).getRepository(Event).findAll() 
    oldEvents = updatedEvents.filter((event) => event.createdAt < sub(new Date(), { months: 3 }))

    expect(oldEvents).toHaveLength(0)
  })
})
