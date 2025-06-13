import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import Invite from '../entities/invite'
import User, { UserType } from '../entities/user'
import InvitePolicy from '../policies/invite.policy'
import JoinOrganisation from '../emails/join-organisation-mail'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import queueEmail from '../lib/messaging/queueEmail'
import { TraceService } from '../lib/routing/trace-service'

@TraceService()
export default class InviteService extends Service {
  @Route({
    method: 'GET'
  })
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

  @Route({
    method: 'POST'
  })
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

    const invite = new Invite(inviter.organisation)
    invite.email = email
    invite.type = type
    invite.invitedByUser = inviter

    createGameActivity(em, {
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
