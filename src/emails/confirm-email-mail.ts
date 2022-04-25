import User from '../entities/user'
import Mail from './mail'

export default class ConfirmEmail extends Mail {
  constructor(user: User, code: string) {
    super(user.email, 'Welcome to Talo', `Hi, ${user.username}! Thanks for signing up to Talo. You'll need to confirm your account to get started.`)

    this.title = 'Welcome!'
    this.mainText = `Hi, ${user.username}! Thanks for signing up to Talo. To confirm your account, enter the following code into the dashboard: <strong>${code}</strong>`

    this.template = this.template.replace('{{mainText}}', this.mainText)

    this.ctaLink = process.env.ALLOWED_ORIGIN
    this.ctaText = 'Go to your dashboard'
  }
}
