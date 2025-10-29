import { After, Before, Service, Request, Response, Route } from 'koa-clay'
import User, { UserType } from '../../entities/user'
import { EntityManager } from '@mikro-orm/mysql'
import buildTokenPair from '../../lib/auth/buildTokenPair'
import Organisation from '../../entities/organisation'
import createQueue from '../../lib/queues/createQueue'
import UserSession from '../../entities/user-session'
import bcrypt from 'bcrypt'
import GameActivity from '../../entities/game-activity'
import { Job, Queue } from 'bullmq'
import { generateDemoEvents } from '../../lib/demo-data/generateDemoEvents'
import { getMikroORM } from '../../config/mikro-orm.config'

type DemoUserJob = {
  userId: number
}

async function scheduleDeletion(req: Request, res: Response<{ user: User }>, caller: DemoService): Promise<void> {
  /* v8 ignore next 3 */
  if (res.status === 200) {
    await caller.queue.add('demo-user', { userId: res.body!.user.id }, { delay: 3_600_000 })
  }
}

export default class DemoService extends Service {
  queue: Queue<DemoUserJob>

  constructor() {
    super()

    this.queue = createQueue<DemoUserJob>('demo', async (job: Job<DemoUserJob>) => {
      const { userId } = job.data

      const orm = await getMikroORM()
      const em = orm.em.fork()

      const sessions = await em.getRepository(UserSession).find({ user: { id: userId } })
      const activities = await em.getRepository(GameActivity).find({ user: { id: userId } })
      const user = await em.getRepository(User).findOne(userId)

      await em.removeAndFlush([user, ...sessions, ...activities])
    })
  }

  @Route({
    method: 'POST'
  })
  @Before(generateDemoEvents)
  @After(scheduleDeletion)
  async post(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const user = new User()
    user.username = `demo+${Date.now()}`
    user.email = `${user.username}@demo.io`
    user.type = UserType.DEMO
    user.organisation = await em.repo(Organisation).findOneOrFail({
      name: process.env.DEMO_ORGANISATION_NAME
    }, {
      populate: ['games']
    })
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
