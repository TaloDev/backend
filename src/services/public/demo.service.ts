import { After, HookParams, Service, ServiceRequest, ServiceResponse } from 'koa-rest-services'
import User, { UserType } from '../../entities/user'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import Queue from 'bee-queue'
import Organisation from '../../entities/organisation'
import { add } from 'date-fns'
import ormConfig from '../../config/mikro-orm.config'
import createQueue from '../../lib/queues/createQueue'

export default class DemoService implements Service {
  queue: Queue

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.queue = createQueue('demo')

      this.queue.process(async (job: Queue.Job<any>) => {
        const { userId } = job.data
    
        const orm = await MikroORM.init(ormConfig)
        const user = await orm.em.getRepository(User).findOne(userId)
    
        await orm.em.removeAndFlush(user)
        await orm.close()
      })
    }
  }

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
        ?.createJob({ userId: hook.result.body.user.id })
        .delayUntil(add(Date.now(), { hours: 1 }))
        .save()
    }
  }
}
