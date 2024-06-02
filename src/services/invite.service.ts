import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import Invite from '../entities/invite.js'
import User, { UserType } from '../entities/user.js'
import InvitePolicy from '../policies/invite.policy.js'
import JoinOrganisation from '../emails/join-organisation-mail.js'
import createGameActivity from '../lib/logging/createGameActivity.js'
import { GameActivityType } from '../entities/game-activity.js'
import { PricingPlanActionType } from '../entities/pricing-plan-action.js'
import handlePricingPlanAction from '../lib/billing/handlePricingPlanAction.js'
import queueEmail from '../lib/messaging/queueEmail.js'

export default class InviteService extends Service {
  @HasPermission(InvitePolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const invites = await em.getRepository(Invite).find({
      organisation: (req.ctx.state.user as User).organisation
    })

    return {
      status: 200,
      body: {
        invites
      }
    }
  }

  @Validate({
    body: [Invite]
  })
  @HasPermission(InvitePolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { email, type } = req.body
    const em: EntityManager = req.ctx.em

    const inviter: User = req.ctx.state.user

    const duplicateEmailUser = await em.getRepository(User).findOne({ email: email.toLowerCase() })
    if (duplicateEmailUser) {
      req.ctx.throw(400, 'This email address is already in use')
    }

    const duplicateEmailInvite = await em.getRepository(Invite).findOne({ email: email.toLowerCase() })
    if (duplicateEmailInvite) {
      req.ctx.throw(400, duplicateEmailInvite.organisation.id === inviter.organisation.id
        ? 'An invite for this email address already exists'
        : 'This email address is already in use'
      )
    }

    await handlePricingPlanAction(req, PricingPlanActionType.USER_INVITE, { invitedUserEmail: email })

    const invite = new Invite(inviter.organisation)
    invite.email = email
    invite.type = type
    invite.invitedByUser = inviter

    await createGameActivity(em, {
      user: req.ctx.state.user,
      type: GameActivityType.INVITE_CREATED,
      extra: {
        inviteEmail: invite.email,
        display: {
          'User type': type === UserType.ADMIN ? 'Admin' : 'Developer'
        }
      }
    })

    await em.persistAndFlush(invite)

    await queueEmail(req.ctx.emailQueue, new JoinOrganisation(invite))

    return {
      status: 200,
      body: {
        invite
      }
    }
  }
}
