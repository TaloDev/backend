import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Game from './game'
import User from './user'

export enum APIKeyScope {
  READ_GAME_FEEDBACK = 'read:gameFeedback',
  WRITE_GAME_FEEDBACK = 'write:gameFeedback',
  READ_GAME_CONFIG = 'read:gameConfig',
  WRITE_GAME_CONFIG = 'write:gameConfig',
  READ_GAME_STATS = 'read:gameStats',
  WRITE_GAME_STATS = 'write:gameStats',
  READ_GAME_SAVES = 'read:gameSaves',
  WRITE_GAME_SAVES = 'write:gameSaves',
  READ_LEADERBOARDS = 'read:leaderboards',
  WRITE_LEADERBOARDS = 'write:leaderboards',
  READ_PLAYERS = 'read:players',
  WRITE_PLAYERS = 'write:players',
  READ_EVENTS = 'read:events',
  WRITE_EVENTS = 'write:events',
  FULL_ACCESS = '*'
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

  @Property({ nullable: true })
  lastUsedAt?: Date

  constructor(game: Game, createdByUser: User) {
    this.game = game
    this.createdByUser = createdByUser
  }

  toJSON() {
    return {
      id: this.id,
      scopes: this.scopes,
      gameId: this.game.id,
      createdBy: this.createdByUser.username,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt
    }
  }
}
