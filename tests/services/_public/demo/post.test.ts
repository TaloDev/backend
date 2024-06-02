import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import Event from '../../../../src/entities/event.js'
import Organisation from '../../../../src/entities/organisation.js'
import OrganisationFactory from '../../../fixtures/OrganisationFactory.js'
import User, { UserType } from '../../../../src/entities/user.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import { sub } from 'date-fns'
import randomDate from '../../../../src/lib/dates/randomDate.js'

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

  it('should insert events if there arent any for the last month', async () => {
    const game = await new GameFactory(demoOrg).one()
    const players = await new PlayerFactory([game]).many(2)

    let eventsThisMonth = await (<EntityManager>global.em).getRepository(Event).find({
      createdAt: {
        $gte: sub(new Date(), { months: 1 })
      }
    })

    expect(eventsThisMonth).toHaveLength(0)

    const randomEvents = await new EventFactory(players).with(() => ({
      createdAt: randomDate(sub(new Date(), { years: 1 }), sub(new Date(), { months: 2 }))
    })).many(20)
    await (<EntityManager>global.em).persistAndFlush(randomEvents)

    await request(global.app)
      .post('/public/demo')
      .expect(200)

    eventsThisMonth = await (<EntityManager>global.em).getRepository(Event).find({
      createdAt: {
        $gte: sub(new Date(), { months: 1 })
      }
    })

    expect(eventsThisMonth.length).toBeGreaterThan(0)
  })
})
