import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import { sign } from '../lib/auth/jwt'

export const playerAuthErrorCodes = [
  'INVALID_CREDENTIALS',
  'VERIFICATION_ALIAS_NOT_FOUND',
  'VERIFICATION_CODE_INVALID',
  'IDENTIFIER_TAKEN',
  'MISSING_SESSION',
  'INVALID_SESSION',
  'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD',
  'NEW_EMAIL_MATCHES_CURRENT_EMAIL',
  'PASSWORD_RESET_CODE_INVALID',
  'VERIFICATION_EMAIL_REQUIRED',
  'INVALID_EMAIL'
] as const

export type PlayerAuthErrorCode = typeof playerAuthErrorCodes[number]

@Entity()
export default class PlayerAuth {
  @PrimaryKey()
  id!: number

  @OneToOne(() => Player, (player) => player.auth)
  player!: Player

  @Property({ hidden: true })
  password!: string

  @Property({ nullable: true })
  email: string | null = null

  @Property({ default: false })
  verificationEnabled!: boolean

  @Property({ nullable: true })
  sessionKey: string | null = null

  @Property({ nullable: true })
  sessionCreatedAt: Date | null = null

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  async createSession(alias: PlayerAlias): Promise<string> {
    this.player.lastSeenAt = new Date()

    this.sessionKey = v4()
    this.sessionCreatedAt = new Date()

    const payload = { playerId: this.player.id, aliasId: alias.id }
    return sign(payload, this.sessionKey)
  }

  clearSession() {
    this.sessionKey = null
    this.sessionCreatedAt = null
  }

  toJSON() {
    return {
      email: this.email,
      verificationEnabled: this.verificationEnabled,
      sessionCreatedAt: this.sessionCreatedAt
    }
  }
}
