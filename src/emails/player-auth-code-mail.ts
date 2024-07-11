import PlayerAlias from '../entities/player-alias'
import Mail from './mail'

export default class PlayerAuthCode extends Mail {
  constructor(alias: PlayerAlias, code: string) {
    super(alias.player.auth.email, `Your ${alias.player.game.name} verification code`, `Hi ${alias.identifier}, here's your verification code to login to ${alias.player.game.name}.`)

    this.title = `Login to ${alias.player.game.name}`
    this.mainText = `Hi ${alias.identifier}, your verification code is: <strong>${code}</strong>.<br/>This code is only valid for 5 minutes.`

    this.footer = 'Didn\'t request a code?'
    this.footerText = 'Your account is still secure, however, you should update your password as soon as possible.'

    this.why = `You are receiving this email because you enabled email verification for your ${alias.player.game.name} account`
  }
}
