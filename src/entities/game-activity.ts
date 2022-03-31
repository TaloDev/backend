import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import User from './user'

export enum GameActivityType {
  PLAYER_PROPS_UPDATED,
  LEADERBOARD_CREATED,
  LEADERBOARD_UPDATED,
  LEADERBOARD_DELETED,
  LEADERBOARD_ENTRY_HIDDEN,
  LEADERBOARD_ENTRY_RESTORED,
  API_KEY_CREATED,
  API_KEY_REVOKED,
  GAME_STAT_CREATED,
  GAME_STAT_UPDATED,
  GAME_STAT_DELETED
}

@Entity()
export default class GameActivity {
  @PrimaryKey()
  id: number

  @ManyToOne(() => Game)
  game: Game

  @ManyToOne(() => User)
  user: User

  @Enum(() => GameActivityType)
  type: GameActivityType

  @Property({ type: 'json' })
  extra: {
    [key: string]: unknown,
    display?: {
      [key: string]: unknown
    }
  } = {}

  @Property()
  createdAt: Date = new Date()

  constructor(game: Game, user: User) {
    this.game = game
    this.user = user
  }

  /* istanbul ignore next */
  private getActivity(): string {
    switch (this.type) {
      case GameActivityType.PLAYER_PROPS_UPDATED:
        return `${this.user.email} updated a player's props`
      case GameActivityType.LEADERBOARD_CREATED:
        return `${this.user.email} created the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_UPDATED:
        return `${this.user.email} updated the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_DELETED:
        return `${this.user.email} deleted the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_HIDDEN:
        return `${this.user.email} hid a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_RESTORED:
        return `${this.user.email} restored a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.API_KEY_CREATED:
        return `${this.user.email} created an access key`
      case GameActivityType.API_KEY_REVOKED:
        return `${this.user.email} remove an access key`
      case GameActivityType.GAME_STAT_CREATED:
        return `${this.user.email} created the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_UPDATED:
        return `${this.user.email} updated the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_DELETED:
        return `${this.user.email} deleted the stat ${this.extra.statInternalName}`
      default:
        return ''
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.getActivity(),
      extra: this.extra.display,
      createdAt: this.createdAt
    }
  }
}
