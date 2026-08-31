import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import bcrypt from 'bcrypt'
import { v4 } from 'uuid'
import { getGlobalQueue } from '../../../config/global-queues.js'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import APIKey from '../../../entities/api-key.js'
import Invite from '../../../entities/invite.js'
import Organisation from '../../../entities/organisation.js'
import UserAccessCode from '../../../entities/user-access-code.js'
import UserPinnedGroup from '../../../entities/user-pinned-group.js'
import UserRecoveryCode from '../../../entities/user-recovery-code.js'
import UserSession from '../../../entities/user-session.js'
import User, { UserType } from '../../../entities/user.js'
import initStripe from '../../../lib/billing/initStripe.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { passwordSchema } from '../../../lib/validation/passwordSchema.js'
import { clearRefreshTokenCookie, confirmPassword } from './common.js'

async function anonymiseUser(user: User) {
  user.email = `${user.id}@deleted.invalid`
  user.username = `${user.id}`
  user.password = await bcrypt.hash(v4(), 10)
  user.emailConfirmed = false
  user.twoFactorAuth = null
  user.deletedAt = new Date()
}

async function deleteUserData(em: EntityManager, user: User) {
  const sessions = await em.repo(UserSession).find({ user })
  em.remove(sessions)

  const accessCodes = await em.repo(UserAccessCode).find({ user })
  em.remove(accessCodes)

  const recoveryCodes = await em.repo(UserRecoveryCode).find({ user })
  em.remove(recoveryCodes)

  const pinnedGroups = await em.repo(UserPinnedGroup).find({ user })
  em.remove(pinnedGroups)
}

async function deleteUser(em: EntityManager, user: User) {
  await anonymiseUser(user)
  await deleteUserData(em, user)
}

async function cancelOrganisationSubscription(org: Organisation) {
  const stripe = initStripe()
  const stripeCustomerId = org.pricingPlan.stripeCustomerId

  /* v8 ignore next 3 -- @preserve */
  if (!stripe || !stripeCustomerId) {
    return
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
    })

    for (const subscription of subscriptions.data) {
      await stripe.subscriptions.cancel(subscription.id)
    }
  } catch (err) {
    console.error('Failed to cancel organisation subscription', err)
    captureException(err)
  }
}

async function anonymiseOrganisation(em: EntityManager, user: User) {
  const organisation = user.organisation

  await cancelOrganisationSubscription(organisation)

  organisation.name = `${organisation.id}`
  organisation.email = `${organisation.id}@deleted.invalid`
  organisation.deletedAt = new Date()

  for (const game of organisation.games.getItems()) {
    const keys = await em.repo(APIKey).find({ game, revokedAt: null })
    for (const key of keys) {
      key.revokedAt = new Date()
    }

    const adminKeys = await em.repo(AdminAPIKey).find({ game, revokedAt: null })
    for (const key of adminKeys) {
      key.revokedAt = new Date()
    }

    // enable purging so deleteInactivePlayers mops up players if the queue job fails
    game.purgeDevPlayers = true
    game.purgeLivePlayers = true
  }

  const invites = await em.repo(Invite).find({ organisation })
  em.remove(invites)

  // include deleted users so this is idempotent
  const allUsers = await em.repo(User).find({ organisation }, { filters: false })

  for (const orgUser of allUsers) {
    await deleteUser(em, orgUser)
  }
}

export const deleteRoute = protectedRoute({
  method: 'post',
  path: '/delete',
  schema: (z) => ({
    body: z.object({
      password: passwordSchema,
    }),
  }),
  middleware: withMiddleware(confirmPassword),
  handler: async (ctx) => {
    const em = ctx.em
    const user = ctx.state.user

    if (user.type === UserType.OWNER) {
      await anonymiseOrganisation(em, user)
    } else {
      await deleteUser(em, user)
    }

    await em.flush()

    if (user.type === UserType.OWNER) {
      try {
        const queue = getGlobalQueue('delete-organisation')
        await queue.add('delete-organisation', { organisationId: user.organisation.id })
      } catch (err) {
        console.error(
          `Failed to enqueue player deletion for organisation ${user.organisation.id}`,
          err,
        )
        captureException(err)
      }
    }

    clearRefreshTokenCookie(ctx)

    return {
      status: 204,
    }
  },
})
