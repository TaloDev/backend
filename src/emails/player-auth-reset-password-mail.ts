import PlayerAlias from '../entities/player-alias.js'
import Mail from './mail.js'

export default class PlayerAuthResetPassword extends Mail {
  constructor(alias: PlayerAlias, code: string) {
    super(
      alias.player.auth!.email!,
      `Reset your ${alias.player.game.name} password`,
      `Hi ${alias.identifier}. A password reset was requested for your account. If you didn't request this you can safely ignore this email.`,
    )

    const gameLogoUrl = alias.player.game.logoUrl
    const gameWebsite = alias.player.game.website

    if (gameLogoUrl && gameWebsite) {
      this.logoUrl = gameLogoUrl
      this.logoLink = gameWebsite
    } else {
      this.logoUrl = ''
      this.logoLink = ''
    }

    this.fromName = alias.player.game.name

    this.title = 'Reset your password'
    this.mainText = `Hi ${alias.identifier}, a password reset requested was created for your ${alias.player.game.name} account.<br/><br/>Your reset code is: <strong>${code}</strong>.<br/>This code is only valid for 15 minutes.`

    this.footer = "Didn't request a code?"
    this.footerText = 'Your account is still secure and you can safely ignore this email.'

    this.why = ''
  }
}
