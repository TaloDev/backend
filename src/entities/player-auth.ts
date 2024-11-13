import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { v4 } from 'uuid'
import { promisify } from 'util'
import jwt from 'jsonwebtoken'
import PlayerAlias from './player-alias'

export enum PlayerAuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  VERIFICATION_ALIAS_NOT_FOUND = 'VERIFICATION_ALIAS_NOT_FOUND',
  VERIFICATION_CODE_INVALID = 'VERIFICATION_CODE_INVALID',
  IDENTIFIER_TAKEN = 'IDENTIFIER_TAKEN',
  MISSING_SESSION = 'MISSING_SESSION',
  INVALID_SESSION = 'INVALID_SESSION',
  NEW_PASSWORD_MATCHES_CURRENT_PASSWORD = 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD',
  NEW_EMAIL_MATCHES_CURRENT_EMAIL = 'NEW_EMAIL_MATCHES_CURRENT_EMAIL',
  PASSWORD_RESET_CODE_INVALID = 'PASSWORD_RESET_CODE_INVALID',
  VERIFICATION_EMAIL_REQUIRED = 'VERIFICATION_EMAIL_REQUIRED',
  INVALID_EMAIL = 'INVALID_EMAIL'
}

@Entity()
export default class PlayerAuth {
  @PrimaryKey()
  id: number

  @OneToOne(() => Player, (player) => player.auth)
  player: Player

  @Property({ hidden: true })
  password: string

  @Property({ nullable: true })
  email: string

  @Property({ default: false })
  verificationEnabled: boolean

  @Property({ hidden: false, nullable: true })
  sessionKey: string

  @Property({ nullable: true })
  sessionCreatedAt: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  async createSession(alias: PlayerAlias): Promise<string> {
    this.player.lastSeenAt = new Date()

    this.sessionKey = v4()
    this.sessionCreatedAt = new Date()

    const payload = { playerId: this.player.id, aliasId: alias.id }
    return await promisify(jwt.sign)(payload, this.sessionKey)
  }

  toJSON() {
    return {
      email: this.email,
      verificationEnabled: this.verificationEnabled,
      sessionCreatedAt: this.sessionCreatedAt
    }
  }
}
