import { publicRouter } from '../../../lib/routing/router'
import User, { UserType } from '../../../entities/user'
import Organisation from '../../../entities/organisation'
import bcrypt from 'bcrypt'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { generateDemoEvents } from '../../../lib/demo-data/generateDemoEvents'
import { createDemoUserQueue } from '../../../lib/queues/createDemoUserQueue'

let demoQueue: ReturnType<typeof createDemoUserQueue> | null = null

function getDemoQueue() {
  if (!demoQueue) {
    demoQueue = createDemoUserQueue()
  }
  return demoQueue
}

export function demoRouter() {
  return publicRouter('/public', ({ route }) => {
    route({
      method: 'post',
      path: '/demo',
      handler: async (ctx) => {
        const em = ctx.em

        await generateDemoEvents(ctx)

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

        await em.persist(user).flush()

        const accessToken = await buildTokenPair({
          em,
          ctx,
          user,
          userAgent: ctx.get('user-agent')
        })

        // schedule deletion after 1 hour
        await getDemoQueue().add('demo-user', {
          userId: user.id
        }, {
          delay: 3_600_000
        })

        return {
          status: 200,
          body: {
            accessToken,
            user
          }
        }
      }
    })
  })
}
