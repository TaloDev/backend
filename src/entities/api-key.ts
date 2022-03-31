import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import User from './user'
import jwt from 'jsonwebtoken'

export enum APIKeyScope {
  READ_GAME_STATS = 'read:gameStats',
  WRITE_GAME_STATS = 'write:gameStats',
  READ_GAME_SAVES = 'read:gameSaves',
  WRITE_GAME_SAVES = 'write:gameSaves',
  READ_LEADERBOARDS = 'read:leaderboards',
  WRITE_LEADERBOARDS = 'write:leaderboards',
  READ_PLAYERS = 'read:players',
  WRITE_PLAYERS = 'write:players',
  READ_EVENTS = 'read:events',
  WRITE_EVENTS = 'write:events'
}

@Entity()
export default class APIKey {
  @PrimaryKey()
  id: number

  @Enum({ items: () => APIKeyScope, array: true })
  scopes: APIKeyScope[] = []

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => User)
  createdByUser: User

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  revokedAt?: Date

  constructor(game: Game, createdByUser: User) {
    this.game = game
    this.createdByUser = createdByUser
  }

  createTokenSync(apiKey: APIKey, iat: number) {
    const payload = { sub: apiKey.id, api: true, iat }
    return jwt.sign(payload, process.env.JWT_SECRET)
  }

  toJSON() {
    const iat = new Date(this.createdAt).getTime()
    const token = this.createTokenSync(this, Math.floor(iat / 1000))

    return {
      id: this.id,
      token: token.substring(token.length - 5, token.length),
      scopes: this.scopes,
      gameId: this.game.id,
      createdBy: this.createdByUser.email, // todo user name field
      createdAt: this.createdAt
    }
  }
}
