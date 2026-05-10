import { getGlobalQueue } from '../../../config/global-queues.js'
import MemberRemovedMail from '../../../emails/member-removed-mail.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Invite from '../../../entities/invite.js'
import UserPinnedGroup from '../../../entities/user-pinned-group.js'
import UserSession from '../../../entities/user-session.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import queueEmail from '../../../lib/messaging/queueEmail.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { createOrganisationForUser } from '../../../lib/users/createOrganisationForUser.js'
import { ownerGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

export const removeMemberRoute = protectedRoute({
  method: 'delete',
  path: '/members/:userId',
  schema: (z) => ({
    route: z.object({
      userId: z.coerce.number().int().positive(),
    }),
  }),
  middleware: withMiddleware(
    ownerGate('remove organisation members'),
    requireEmailConfirmed('remove organisation members'),
  ),
  handler: async (ctx) => {
    const { userId } = ctx.state.validated.route
    const em = ctx.em
    const caller = ctx.state.user

    if (userId === caller.id) {
      return ctx.throw(403, 'You cannot remove yourself from your organisation')
    }

    const target = await em.repo(User).findOne({ id: userId, organisation: caller.organisation })
    if (!target) {
      return ctx.throw(404, 'User not found')
    }

    await em.transactional(async (trx) => {
      target.organisation = await createOrganisationForUser(trx, target.username, target.email)
      target.type = UserType.OWNER

      await trx.nativeDelete(UserSession, { user: target })
      await trx.nativeDelete(UserPinnedGroup, { user: target })
      await trx.nativeDelete(Invite, { invitedByUser: target, organisation: caller.organisation })

      createGameActivity(trx, {
        user: caller,
        type: GameActivityType.ORGANISATION_MEMBER_REMOVED,
        extra: {
          removedUserId: target.id,
          removedUsername: target.username,
          display: {
            'Removed user': target.username,
          },
        },
      })
    })

    await deferClearResponseCache(UserPinnedGroup.getCacheKeyForUser(target))

    await queueEmail(getGlobalQueue('email'), new MemberRemovedMail(target, caller.organisation))

    return { status: 204 }
  },
})
