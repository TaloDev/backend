import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import Organisation from '../../../../src/entities/organisation'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import User, { UserType } from '../../../../src/entities/user'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameFactory from '../../../fixtures/GameFactory'
import { sub } from 'date-fns'

describe('Demo service - post', () => {
  let demoOrg: Organisation

  beforeAll(async () => {
    demoOrg = await new OrganisationFactory().state('demo').one()
    await (<EntityManager>global.em).persistAndFlush(demoOrg)
  })

  it('should create a demo user and then delete them', async () => {
    const res = await request(global.app)
      .post('/public/demo')
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation.id).toBe(demoOrg.id)
    expect(res.body.user.type).toBe(UserType.DEMO)

    expect(res.body.accessToken).toBeTruthy()

    const user = await (<EntityManager>global.em).getRepository(User).findOne(res.body.user.id)
    expect(user).toBeNull()
  })

  it('should update the createdAt of events older than 3 months', async () => {
    const game = await new GameFactory(demoOrg).one()
    const players = await new PlayerFactory([game]).many(2)
    let events = await new EventFactory(players).state('this year').many(20)
    await (<EntityManager>global.em).persistAndFlush(events)

    events = events.filter((event) => event.createdAt < sub(new Date(), { months: 3 }))
    expect(events.length).toBeGreaterThan(0)

    await request(global.app)
      .post('/public/demo')
      .expect(200)

    for (const event of events) {
      await (<EntityManager>global.em).refresh(event)
    }
    events = events.filter((event) => event.createdAt < sub(new Date(), { months: 3 }))

    expect(events).toHaveLength(0)
  })
})
