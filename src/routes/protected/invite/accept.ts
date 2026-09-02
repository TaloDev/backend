import { GameActivityType } from '../../../entities/game-activity.js'
import Invite from '../../../entities/invite.js'
import OrganisationMember from '../../../entities/organisation-member.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

export const acceptInviteRoute = protectedRoute({
  method: 'post',
  path: '/join',
  schema: (z) => ({
    body: z.object({
      token: z.string().min(1),
    }),
  }),
  middleware: withMiddleware(requireEmailConfirmed('join organisations')),
  handler: async (ctx) => {
    const { token } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.user

    const invite = await em.repo(Invite).findOne({ token }, { populate: ['organisation'] })
    if (!invite || invite.email !== user.email) {
      return ctx.throw(404, 'Invite not found')
    }

    const existingMembership = await em.repo(OrganisationMember).findOne({
      user,
      organisation: invite.organisation,
    })
    if (existingMembership) {
      await em.remove(invite).flush()
      return {
        status: 200,
        body: {
          user,
        },
      }
    }

    user.organisation = invite.organisation
    user.type = invite.type
    user.memberships.add(new OrganisationMember(user, invite.organisation, invite.type))

    createGameActivity(em, { actor: user, type: GameActivityType.INVITE_ACCEPTED })

    await em.remove(invite).flush()

    return {
      status: 200,
      body: {
        user,
      },
    }
  },
})
