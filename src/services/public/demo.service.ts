import { After, Before, Service, Request, Response } from 'koa-clay'
import User, { UserType } from '../../entities/user'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import Queue from 'bee-queue'
import Organisation from '../../entities/organisation'
import { add, sub } from 'date-fns'
import ormConfig from '../../config/mikro-orm.config'
import createQueue from '../../lib/queues/createQueue'
import UserSession from '../../entities/user-session'
import Event from '../../entities/event'
import randomDate from '../../lib/dates/randomDate'
import bcrypt from 'bcrypt'

interface DemoUserJob {
  userId: number
}

async function scheduleDeletion(req: Request, res: Response, caller: DemoService): Promise<void> {
  /* istanbul ignore else */
  if (res.status === 200) {
    await caller.queue
      .createJob<DemoUserJob>({ userId: res.body.user.id })
      .delayUntil(add(Date.now(), { hours: 1 }))
      .save()
  }
}

async function updateEventDates(req: Request): Promise<void> {
  const em: EntityManager = req.ctx.em

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

  for (const event of events) {
    event.createdAt = randomDate(sub(new Date(), { months: 2 }), new Date())
  }

  await em.flush()
}

export default class DemoService implements Service {
  queue: Queue

  constructor() {
    this.queue = createQueue('demo')

    this.queue.process(async (job: Queue.Job<DemoUserJob>) => {
      const { userId } = job.data

      const orm = await MikroORM.init(ormConfig)

      const sessions = await orm.em.getRepository(UserSession).find({ user: { id: userId } })
      const user = await orm.em.getRepository(User).findOne(userId)

      await orm.em.removeAndFlush([user, ...sessions])
      await orm.close()
    })
  }

  @Before(updateEventDates)
  @After(scheduleDeletion)
  async post(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const user = new User()
    user.username = `demo+${Date.now()}`
    user.email = `${user.username}@demo.io`
    user.type = UserType.DEMO
    user.organisation = await em.getRepository(Organisation).findOne({ name: process.env.DEMO_ORGANISATION_NAME })
    user.emailConfirmed = true
    user.password = await bcrypt.hash(user.email, 10)

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
}
