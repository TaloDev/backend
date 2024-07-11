import User from '../entities/user'
import Mail from './mail'

export default class ResetPassword extends Mail {
  constructor(user: User, accessToken: string) {
    super(user.email, 'Reset your password', `Hi ${user.username}, a password reset was requested for your account. If you didn't request this you can safely ignore this email.`)

    this.title = 'Reset your password'
    this.mainText = `Hi ${user.username},<br/><br/>A password reset was requested for your account - please follow the link below to create a new password. This link is only valid for 15 minutes.<br/><br/>If you didn't request this you can safely ignore this email.`

    this.ctaLink = process.env.DASHBOARD_URL + `/reset-password?token=${accessToken}`
    this.ctaText = 'Reset your password'
  }
}
