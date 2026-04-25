import User from '../entities/user'
import Mail from './mail'

export default class MemberRemovedMail extends Mail {
  constructor(user: User) {
    super(
      user.email,
      "You've been removed from your organisation on Talo",
      `Hi ${user.username}, you've been removed from your organisation. A new personal organisation has been created for you.`,
    )

    this.title = 'You have been removed from your organisation'
    this.mainText = `Hi ${user.username}, you've been removed from your organisation on Talo. We've moved your account to a new personal organisation, so you can continue to use Talo.`

    this.ctaLink = `${process.env.DASHBOARD_URL}/login`
    this.ctaText = 'Log in to Talo'

    this.why = 'You are receiving this email because you were removed from a Talo organisation'
  }
}
