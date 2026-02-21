import bcrypt from 'bcrypt'
import Organisation from '../../../entities/organisation'
import User, { UserType } from '../../../entities/user'
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { generateDemoEvents } from '../../../lib/demo-data/generateDemoEvents'
import { createDemoUserQueue } from '../../../lib/queues/createDemoUserQueue'
import { publicRouter } from '../../../lib/routing/router'

let demoQueue: ReturnType<typeof createDemoUserQueue> | null = null

function getDemoQueue() {
  if (!demoQueue) {
    demoQueue = createDemoUserQueue()
  }
  return demoQueue
}

export function demoRouter() {
  return publicRouter('/public/demo', ({ route }) => {
    route({
      method: 'post',
      handler: async (ctx) => {
        const em = ctx.em

        await generateDemoEvents(ctx)

        const user = new User()
        user.username = `demo+${Date.now()}`
        user.email = `${user.username}@demo.io`
        user.type = UserType.DEMO
        user.organisation = await em.repo(Organisation).findOneOrFail(
          {
            name: process.env.DEMO_ORGANISATION_NAME,
          },
          {
            populate: ['games'],
          },
        )
        user.emailConfirmed = true
        user.password = await bcrypt.hash(user.email, 10)

        await em.persist(user).flush()

        const accessToken = await buildTokenPair({
          em,
          ctx,
          user,
          userAgent: ctx.get('user-agent'),
        })

        // schedule deletion after 1 hour
        await getDemoQueue().add(
          'demo-user',
          {
            userId: user.id,
          },
          {
            delay: 3_600_000,
          },
        )

        return {
          status: 200,
          body: {
            accessToken,
            user,
          },
        }
      },
    })
  })
}
