import { publicRoute } from '../../../lib/routing/router'
import User, { UserType } from '../../../entities/user'
import Organisation from '../../../entities/organisation'
import Invite from '../../../entities/invite'
import UserAccessCode from '../../../entities/user-access-code'
import bcrypt from 'bcrypt'
import { add } from 'date-fns'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import createDefaultPricingPlan from '../../../lib/billing/createDefaultPricingPlan'
import queueEmail from '../../../lib/messaging/queueEmail'
import ConfirmEmail from '../../../emails/confirm-email-mail'
import { getGlobalQueue } from '../../../config/global-queues'
import { buildTokenPair } from './common'

export const registerRoute = publicRoute({
  method: 'post',
  path: '/register',
  schema: (z) => ({
    body: z.object({
      email: z.string().email('Email address is invalid'),
      username: z.string().min(1),
      password: z.string().min(1),
      organisationName: z.string().optional(),
      inviteToken: z.string().optional()
    }).refine((data) => data.organisationName || data.inviteToken, {
      message: 'Either organisationName or inviteToken is required'
    })
  }),
  handler: async (ctx) => {
    const { email, username, password, organisationName, inviteToken } = ctx.request.body
    const em = ctx.em

    const registrationMode = process.env.REGISTRATION_MODE || 'open'
    if (registrationMode === 'disabled') {
      ctx.status = 400
      ctx.body = { message: 'Registration is disabled' }
      return
    }
    if (registrationMode === 'exclusive' && !inviteToken) {
      ctx.status = 400
      ctx.body = { message: 'Registration requires an invitation' }
      return
    }

    const userWithEmail = await em.getRepository(User).findOne({ email })
    const orgWithEmail = await em.getRepository(Organisation).findOne({ email })
    if (userWithEmail || orgWithEmail) {
      ctx.status = 400
      ctx.body = { message: 'Email address is already in use' }
      return
    }

    const user = new User()
    user.email = email.trim().toLowerCase()
    user.username = username
    user.password = await bcrypt.hash(password, 10)
    user.emailConfirmed = process.env.AUTO_CONFIRM_EMAIL === 'true'

    if (inviteToken) {
      const invite = await em.getRepository(Invite).findOne({
        token: inviteToken
      }, {
        populate: ['organisation.games']
      })

      if (!invite || invite.email !== email) {
        ctx.status = 404
        ctx.body = { message: 'Invite not found' }
        return
      }

      user.organisation = invite.organisation
      user.type = invite.type
      user.emailConfirmed = true

      createGameActivity(em, { user, type: GameActivityType.INVITE_ACCEPTED })

      em.remove(invite)
    } else {
      const organisation = new Organisation()
      organisation.email = email
      organisation.name = organisationName!
      organisation.pricingPlan = await createDefaultPricingPlan(em, organisation)

      user.organisation = organisation
      user.type = UserType.OWNER
    }

    await em.persistAndFlush(user)
    await em.populate(user, ['organisation'])

    // Send email confirmation if needed
    if (!user.emailConfirmed) {
      const accessCode = new UserAccessCode(user, add(new Date(), { weeks: 1 }))
      await em.persistAndFlush(accessCode)
      await queueEmail(getGlobalQueue('email'), new ConfirmEmail(user, accessCode.code))
    }

    // Build token pair (creates session and sets cookie)
    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })

    ctx.body = {
      accessToken,
      user
    }
  }
})
