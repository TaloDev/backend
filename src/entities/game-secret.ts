import { Entity, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { decrypt, encrypt } from '../lib/crypto/string-encryption'
import Game from './game'
import crypto from 'crypto'

@Entity()
export default class GameSecret {
  @PrimaryKey()
  id: number

  @OneToOne(() => Game, (game) => game.apiSecret)
  game: Game

  @Property({ hidden: true })
  secret: string

  constructor() {
    this.secret = this.generateSecret()
  }

  generateSecret(): string {
    const secret = Buffer.from(crypto.randomBytes(48)).toString('hex')
    return encrypt(secret, process.env.API_SECRET)
  }

  getPlainSecret(): string {
    return decrypt(this.secret, process.env.API_SECRET)
  }

  /* v8 ignore start */
  toJSON() {
    return {
      id: this.id
    }
  }
  /* v8 ignore stop */
}
