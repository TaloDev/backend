import { EntityManager } from '@mikro-orm/core'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import Queue from 'bee-queue'
import Invite from '../entities/invite'
import User from '../entities/user'
import { EmailConfig } from '../lib/messaging/sendEmail'
import InvitePolicy from '../policies/invite.policy'
import JoinOrganisation from '../emails/join-organisation-mail'

export default class InviteService implements Service {
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

    const invite = new Invite(inviter.organisation)
    invite.email = email
    invite.type = type
    invite.invitedByUser = inviter
    await em.persistAndFlush(invite)

    await (<Queue>req.ctx.emailQueue)
      .createJob<EmailConfig>({ mail: new JoinOrganisation(invite).getConfig() })
      .save()

    return {
      status: 200,
      body: {
        invite
      }
    }
  }
}
