import { getGlobalQueue } from '../../../config/global-queues.js'
import JoinOrganisation from '../../../emails/join-organisation-mail.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Invite from '../../../entities/invite.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import queueEmail from '../../../lib/messaging/queueEmail.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      email: z.email(),
      type: z.enum(UserType).refine((val) => [UserType.ADMIN, UserType.DEV].includes(val), {
        error: 'You can only invite an admin or developer user',
      }),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create invites'),
    requireEmailConfirmed('create invites'),
  ),
  handler: async (ctx) => {
    const { email, type } = ctx.state.validated.body
    const em = ctx.em

    const inviter = ctx.state.user

    const duplicateEmailInvite = await em.repo(Invite).findOne({
      email: email.toLowerCase(),
      organisation: inviter.organisation,
    })
    if (duplicateEmailInvite) {
      return ctx.throw(400, 'An invite for this email address already exists')
    }

    const invite = new Invite(inviter.organisation)
    invite.email = email.toLowerCase()
    invite.type = type
    invite.invitedByUser = inviter

    createGameActivity(em, {
      actor: ctx.state.user,
      type: GameActivityType.INVITE_CREATED,
      extra: {
        inviteEmail: invite.email,
        display: {
          'User type': type === UserType.ADMIN ? 'Admin' : 'Developer',
        },
      },
    })

    await em.persist(invite).flush()

    await queueEmail(getGlobalQueue('email'), new JoinOrganisation(invite))

    return {
      status: 200,
      body: {
        invite,
      },
    }
  },
})
