import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { createHash } from 'node:crypto'
import { decrypt, encrypt } from '../lib/crypto/string-encryption.js'
import GameSecret from './game-secret.js'
import Game from './game.js'

@Entity()
export default class GameVerificationKey {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Game)
  game!: Game

  @Property()
  version!: string

  @Property()
  value!: string

  @Property()
  createdAt: Date = new Date()

  static getCacheKey(game: Game, version: string) {
    return `verification-key-${game.id}-${version}`
  }

  private static deriveKeyFromGameSecret(gameSecret: GameSecret) {
    const plainSecret = gameSecret.getPlainSecret()
    return createHash('sha256').update(plainSecret).digest('hex').slice(0, 32)
  }

  static encryptValue(value: string, gameSecret: GameSecret) {
    return encrypt(value, GameVerificationKey.deriveKeyFromGameSecret(gameSecret))
  }

  decryptValue(gameSecret: GameSecret) {
    return decrypt(this.value, GameVerificationKey.deriveKeyFromGameSecret(gameSecret))
  }

  toJSON() {
    return {
      id: this.id,
      version: this.version,
      value: this.decryptValue(this.game.apiSecret),
      createdAt: this.createdAt,
    }
  }
}
