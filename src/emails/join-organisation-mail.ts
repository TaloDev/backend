import Invite from '../entities/invite.js'
import Mail from './mail.js'

export default class JoinOrganisation extends Mail {
  constructor(invite: Invite) {
    super(invite.email, 'You\'ve been invited to Talo', `Hey there, you've been invited by ${invite.invitedByUser.username} to join them and the rest of ${invite.organisation.name} on Talo.`)

    this.title = `Join ${invite.organisation.name} on Talo`
    this.mainText = `Hey there, you've been invited by ${invite.invitedByUser.username} to join them on Talo.`

    this.ctaLink = `${process.env.DASHBOARD_URL}/accept/${invite.token}`
    this.ctaText = 'Accept invite'

    this.why = 'You are receiving this email because you were invited to create a Talo account'
  }
}
