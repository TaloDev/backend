import { After, Before, Service, Request, Response } from 'koa-clay'
import User, { UserType } from '../../entities/user'
import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import Organisation from '../../entities/organisation'
import ormConfig from '../../config/mikro-orm.config'
import createQueue from '../../lib/queues/createQueue'
import UserSession from '../../entities/user-session'
import bcrypt from 'bcrypt'
import GameActivity from '../../entities/game-activity'
import { Job, Queue } from 'bullmq'
import { generateDemoEvents } from '../../lib/demo-data/generateDemoEvents'

type DemoUserJob = {
  userId: number
}

async function scheduleDeletion(req: Request, res: Response, caller: DemoService): Promise<void> {
  /* v8 ignore next 3 */
  if (res.status === 200) {
    await caller.queue.add('demo-user', { userId: res.body.user.id }, { delay: 3600000 })
  }
}

export default class DemoService extends Service {
  queue: Queue<DemoUserJob>

  constructor() {
    super()

    this.queue = createQueue<DemoUserJob>('demo', async (job: Job<DemoUserJob>) => {
      const { userId } = job.data

      const orm = await MikroORM.init(ormConfig)
      const em = orm.em.fork()

      const sessions = await em.getRepository(UserSession).find({ user: { id: userId } })
      const activities = await em.getRepository(GameActivity).find({ user: { id: userId } })
      const user = await em.getRepository(User).findOne(userId)

      await em.removeAndFlush([user, ...sessions, ...activities])
      await orm.close()
    })
  }

  @Before(generateDemoEvents)
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

    await em.persistAndFlush(user)

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
