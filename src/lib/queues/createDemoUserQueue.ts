import createQueue from './createQueue'
import { getMikroORM } from '../../config/mikro-orm.config'
import UserSession from '../../entities/user-session'
import GameActivity from '../../entities/game-activity'
import User from '../../entities/user'

type DemoUserConfig = {
  userId: number
}

export function createDemoUserQueue() {
  const queue = createQueue<DemoUserConfig>('demo', async (job) => {
    const { userId } = job.data

    const orm = await getMikroORM()
    const em = orm.em.fork()

    const sessions = await em.repo(UserSession).find({ user: { id: userId } })
    const activities = await em.repo(GameActivity).find({ user: { id: userId } })
    const user = await em.repo(User).findOne(userId)

    await em.remove([user, ...sessions, ...activities]).flush()
  })

  return queue
}
