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
import { buildTokenPair } from '../../../lib/auth/buildTokenPair'
import { passwordSchema } from '../../../lib/validation/passwordSchema'

export const registerRoute = publicRoute({
  method: 'post',
  path: '/register',
  schema: (z) => ({
    body: z.object({
      email: z.string().email('Email address is invalid'),
      username: z.string().min(1),
      password: passwordSchema,
      organisationName: z.string().optional(),
      inviteToken: z.string().optional()
    }).refine((data) => data.organisationName || data.inviteToken, {
      message: 'Either organisationName or inviteToken is required'
    })
  }),
  handler: async (ctx) => {
    const { email, username, password, organisationName, inviteToken } = ctx.state.validated.body
    const em = ctx.em

    const registrationMode = process.env.REGISTRATION_MODE || 'open'
    if (registrationMode === 'disabled') {
      return {
        status: 400,
        body: { message: 'Registration is disabled' }
      }
    }
    if (registrationMode === 'exclusive' && !inviteToken) {
      return {
        status: 400,
        body: { message: 'Registration requires an invitation' }
      }
    }

    const userWithEmail = await em.repo(User).findOne({ email })
    const orgWithEmail = await em.repo(Organisation).findOne({ email })
    if (userWithEmail || orgWithEmail) {
      return {
        status: 400,
        body: { message: 'Email address is already in use' }
      }
    }

    const user = new User()
    user.email = email.trim().toLowerCase()
    user.username = username
    user.password = await bcrypt.hash(password, 10)
    user.emailConfirmed = process.env.AUTO_CONFIRM_EMAIL === 'true'

    if (inviteToken) {
      const invite = await em.repo(Invite).findOne({
        token: inviteToken
      }, {
        populate: ['organisation.games']
      })

      if (!invite || invite.email !== email) {
        return {
          status: 404,
          body: { message: 'Invite not found' }
        }
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

    await em.persist(user).flush()
    await em.populate(user, ['organisation'])

    if (!user.emailConfirmed) {
      const accessCode = new UserAccessCode(user, add(new Date(), { weeks: 1 }))
      await em.persist(accessCode).flush()
      await queueEmail(getGlobalQueue('email'), new ConfirmEmail(user, accessCode.code))
    }

    const accessToken = await buildTokenPair({ em, ctx, user, userAgent: ctx.get('user-agent') })

    return {
      status: 200,
      body: {
        accessToken,
        user
      }
    }
  }
})
