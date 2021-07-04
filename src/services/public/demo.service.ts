import { After, Before, HookParams, Service, ServiceRequest, ServiceResponse } from 'koa-rest-services'
import User, { UserType } from '../../entities/user'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import Queue from 'bee-queue'
import Organisation from '../../entities/organisation'
import { add, startOfMonth, sub } from 'date-fns'
import ormConfig from '../../config/mikro-orm.config'
import createQueue from '../../lib/queues/createQueue'
import UserSession from '../../entities/user-session'
import Event from '../../entities/event'

export default class DemoService implements Service {
  queue: Queue

  constructor() {
    this.queue = createQueue('demo')

    this.queue.process(async (job: Queue.Job<any>) => {
      let orm: MikroORM
      const { userId } = job.data
  
      try {
        orm = await MikroORM.init(ormConfig)

        const sessions = await orm.em.getRepository(UserSession).findAll({ user: userId })
        const user = await orm.em.getRepository(User).findOne(userId)

        await orm.em.removeAndFlush([user, ...sessions])
      } finally {
        await orm.close()
      }
    })
  }

  @Before('updateEventDates')
  @After('scheduleDeletion')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    const em: EntityManager = req.ctx.em

    const user = new User()
    user.email = `demo+${Date.now()}@demo.io`
    user.type = UserType.DEMO
    user.organisation = await em.getRepository(Organisation).findOne({ name: process.env.DEMO_ORGANISATION_NAME })
    user.emailConfirmed = true

    await em.getRepository(User).persistAndFlush(user)

    const accessToken = await buildTokenPair(req.ctx, user)

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }

  async scheduleDeletion(hook: HookParams): Promise<void> {
    if (hook.result.status === 200) {
      await (<DemoService>hook.caller).queue
        .createJob({ userId: hook.result.body.user.id })
        .delayUntil(add(Date.now(), { hours: 1 }))
        .save()
    }
  }

  async updateEventDates(hook: HookParams): Promise<void> {
    const em: EntityManager = hook.req.ctx.em

    const events = await em.getRepository(Event).find({
      playerAlias: {
        player: {
          game: {
            organisation: {
              name: process.env.DEMO_ORGANISATION_NAME
            }
          }
        }
      },
      createdAt: {
        $lt: sub(new Date(), { months: 3 })
      }
    })

    const min = startOfMonth(new Date())
    const max = new Date()

    for (const event of events) {
      event.createdAt = new Date(min.getTime() + Math.random() * (max.getTime() - min.getTime()))
    }

    await em.flush()
  }
}
