import { getGlobalQueue } from '../../../config/global-queues.js'
import JoinOrganisation from '../../../emails/join-organisation-mail.js'
import Invite from '../../../entities/invite.js'
import { UserType } from '../../../entities/user.js'
import checkRateLimitExceeded from '../../../lib/errors/checkRateLimitExceeded.js'
import queueEmail from '../../../lib/messaging/queueEmail.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireEmailConfirmed, userTypeGate } from '../../../middleware/policy-middleware.js'

export const resendRoute = protectedRoute({
  method: 'post',
  path: '/:id/resend',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'resend invites'),
    requireEmailConfirmed('resend invites'),
  ),
  handler: async (ctx) => {
    const { id } = ctx.params as { id: string }
    const invite = await ctx.em.repo(Invite).findOne({
      id: Number(id),
      organisation: ctx.state.user.organisation,
    })

    if (!invite) {
      return ctx.throw(404, 'Invite not found')
    }

    const rateLimitExceeded = await checkRateLimitExceeded(
      ctx.redis,
      `invite-resend:${invite.email.toLowerCase()}`,
      1,
      60,
    )
    if (rateLimitExceeded) {
      return ctx.throw(429, 'Invites can only be resent once every 60 seconds')
    }

    await queueEmail(getGlobalQueue('email'), new JoinOrganisation(invite))

    return {
      status: 200,
      body: {
        invite,
      },
    }
  },
})
