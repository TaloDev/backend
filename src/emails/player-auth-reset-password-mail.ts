import PlayerAlias from '../entities/player-alias'
import Mail from './mail'

export default class PlayerAuthResetPassword extends Mail {
  constructor(alias: PlayerAlias, code: string) {
    super(
      alias.player.auth!.email!,
      `Reset your ${alias.player.game.name} password`,
      `Hi ${alias.identifier}. A password reset was requested for your account. If you didn't request this you can safely ignore this email.`,
    )

    this.title = 'Reset your password'
    this.mainText = `Hi ${alias.identifier}, a password reset requested was created for your ${alias.player.game.name} account.<br/><br/>Your reset code is: <strong>${code}</strong>.<br/>This code is only valid for 15 minutes.`

    this.footer = "Didn't request a code?"
    this.footerText = 'Your account is still secure and you can safely ignore this email.'

    this.why = `You are receiving this email because your ${alias.player.game.name} account is associated with this email address`
  }
}
