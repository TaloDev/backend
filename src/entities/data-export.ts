import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import User from './user.js'
import Game from './game.js'

export enum DataExportStatus {
  REQUESTED,
  QUEUED,
  GENERATED,
  SENT
}

export enum DataExportAvailableEntities {
  EVENTS = 'events',
  PLAYERS = 'players',
  PLAYER_ALIASES = 'playerAliases',
  LEADERBOARD_ENTRIES = 'leaderboardEntries',
  GAME_STATS = 'gameStats',
  PLAYER_GAME_STATS = 'playerGameStats',
  GAME_ACTIVITIES = 'gameActivities'
}

@Entity()
export default class DataExport {
  @PrimaryKey()
  id: number

  @ManyToOne(() => User)
  createdByUser: User

  @ManyToOne(() => Game)
  game: Game

  @Enum({ items: () => DataExportAvailableEntities, array: true })
  entities: DataExportAvailableEntities[] = []

  @Enum(() => DataExportStatus)
  status: DataExportStatus = DataExportStatus.REQUESTED

  @Property({ nullable: true })
  failedAt: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(createdByUser: User, game: Game) {
    this.createdByUser = createdByUser
    this.game = game
  }

  toJSON() {
    return {
      id: this.id,
      entities: this.entities,
      createdBy: this.createdByUser.username,
      status: this.status,
      createdAt: this.createdAt,
      failedAt: this.failedAt
    }
  }
}
