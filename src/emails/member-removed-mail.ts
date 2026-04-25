import Organisation from '../entities/organisation'
import User from '../entities/user'
import Mail from './mail'

export default class MemberRemovedMail extends Mail {
  constructor(user: User, organisation: Organisation) {
    super(
      user.email,
      'Removed from organisation',
      `Hi ${user.username}, you have been removed from ${organisation.name}. A new personal organisation has been created for you.`,
    )

    this.title = 'Removed from organisation'
    this.mainText = `Hi ${user.username}, you have been removed from ${organisation.name}. We've moved your account to a new personal organisation, so you can continue to use Talo.`

    this.ctaLink = `${process.env.DASHBOARD_URL}/login`
    this.ctaText = 'Log in to Talo'

    this.why = 'You are receiving this email because you were removed from a Talo organisation'
  }
}
