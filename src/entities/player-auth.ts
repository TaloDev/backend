import { Entity, EntityManager, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { v4 } from 'uuid'
import PlayerAlias, { PlayerAliasService } from './player-alias'
import { sign } from '../lib/auth/jwt'
import { getAuthMiddlewareAliasKey, getAuthMiddlewarePlayerKey } from '../middleware/player-auth-middleware'

const errorCodes = [
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

export type PlayerAuthErrorCode = typeof errorCodes[number]

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

  async createSession(em: EntityManager, alias: PlayerAlias): Promise<string> {
    this.player.lastSeenAt = new Date()

    this.sessionKey = v4()
    this.sessionCreatedAt = new Date()
    await this.clearAuthMiddlewareKeys(em)

    const payload = { playerId: this.player.id, aliasId: alias.id }
    return sign(payload, this.sessionKey)
  }

  async clearSession(em: EntityManager) {
    this.sessionKey = null
    this.sessionCreatedAt = null
    await this.clearAuthMiddlewareKeys(em)
  }

  private async clearAuthMiddlewareKeys(em: EntityManager) {
    const alias = await em.repo(PlayerAlias).findOne({
      service: PlayerAliasService.TALO,
      player: this.player
    })

    const keysToClear: string[] = [
      getAuthMiddlewarePlayerKey(this.player.id),
      alias ? getAuthMiddlewareAliasKey(alias.id) : null
    ].filter((key): key is string => key !== null)

    await Promise.all(keysToClear.map((key) => em.clearCache(key)))
  }

  toJSON() {
    return {
      email: this.email,
      verificationEnabled: this.verificationEnabled,
      sessionCreatedAt: this.sessionCreatedAt
    }
  }
}
