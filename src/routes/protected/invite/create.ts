import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import Invite from '../../../entities/invite'
import User from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import queueEmail from '../../../lib/messaging/queueEmail'
import { getGlobalQueue } from '../../../config/global-queues'
import JoinOrganisation from '../../../emails/join-organisation-mail'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      email: z.string().email(),
      type: z.nativeEnum(UserType).refine(
        (val) => [UserType.ADMIN, UserType.DEV].includes(val),
        { message: 'You can only invite an admin or developer user' }
      )
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create invites'),
    requireEmailConfirmed('create invites')
  ),
  handler: async (ctx) => {
    const { email, type } = ctx.state.validated.body
    const em = ctx.em

    const inviter = ctx.state.authenticatedUser

    const duplicateEmailUser = await em.repo(User).findOne({ email: email.toLowerCase() })
    if (duplicateEmailUser) {
      ctx.throw(400, 'This email address is already in use')
    }

    const duplicateEmailInvite = await em.repo(Invite).findOne({ email: email.toLowerCase() })
    if (duplicateEmailInvite) {
      ctx.throw(400, duplicateEmailInvite.organisation.id === inviter.organisation.id
        ? 'An invite for this email address already exists'
        : 'This email address is already in use'
      )
    }

    const invite = new Invite(inviter.organisation)
    invite.email = email
    invite.type = type
    invite.invitedByUser = inviter

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      type: GameActivityType.INVITE_CREATED,
      extra: {
        inviteEmail: invite.email,
        display: {
          'User type': type === UserType.ADMIN ? 'Admin' : 'Developer'
        }
      }
    })

    await em.persist(invite).flush()

    await queueEmail(getGlobalQueue('email'), new JoinOrganisation(invite))

    return {
      status: 200,
      body: {
        invite
      }
    }
  }
})
