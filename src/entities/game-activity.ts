import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import upperFirst from '../lib/lang/upperFirst'
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
  GAME_STAT_DELETED,
  INVITE_CREATED,
  INVITE_ACCEPTED,
  DATA_EXPORT_REQUESTED,
  GAME_INTEGRATION_ADDED,
  GAME_INTEGRATION_UPDATED,
  GAME_INTEGRATION_DELETED,
  GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
  GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED,
  PLAYER_GROUP_CREATED,
  PLAYER_GROUP_UPDATED,
  PLAYER_GROUP_DELETED,
  GAME_PROPS_UPDATED,
  GAME_FEEDBACK_CATEGORY_CREATED,
  GAME_FEEDBACK_CATEGORY_UPDATED,
  GAME_FEEDBACK_CATEGORY_DELETED,
  API_KEY_UPDATED,
  GAME_NAME_UPDATED,
  PLAYER_STAT_UPDATED,
  LEADERBOARD_ENTRY_UPDATED,
  GAME_CHANNEL_CREATED,
  GAME_CHANNEL_UPDATED,
  GAME_CHANNEL_DELETED,
  INACTIVE_DEV_PLAYERS_DELETED,
  INACTIVE_LIVE_PLAYERS_DELETED,
  LEADERBOARD_ENTRIES_RESET,
  GAME_STAT_RESET,
  PLAYER_DELETED,
  GAME_SETTINGS_UPDATED,
}

@Entity()
export default class GameActivity {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Game, { nullable: true })
  game: Game | null = null

  @ManyToOne(() => User)
  user: User

  @Enum(() => GameActivityType)
  type!: GameActivityType

  @Property({ type: 'json' })
  extra: {
    [key: string]: unknown
    display?: {
      [key: string]: unknown
    }
  } = {}

  @Property()
  createdAt: Date = new Date()

  constructor(game: Game | null, user: User) {
    this.game = game
    this.user = user
  }

  /* v8 ignore start */
  private getActivity(): string {
    switch (this.type) {
      case GameActivityType.PLAYER_PROPS_UPDATED:
        return `${this.user.username} updated a player's props`
      case GameActivityType.LEADERBOARD_CREATED:
        return `${this.user.username} created the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_UPDATED:
        return `${this.user.username} updated the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_DELETED:
        return `${this.user.username} deleted the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_HIDDEN:
        return `${this.user.username} hid a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_RESTORED:
        return `${this.user.username} restored a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.API_KEY_CREATED:
        return `${this.user.username} created an access key`
      case GameActivityType.API_KEY_REVOKED:
        return `${this.user.username} revoked an access key`
      case GameActivityType.GAME_STAT_CREATED:
        return `${this.user.username} created the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_UPDATED:
        return `${this.user.username} updated the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_DELETED:
        return `${this.user.username} deleted the stat ${this.extra.statInternalName}`
      case GameActivityType.INVITE_CREATED:
        return `${this.user.username} created an invite for ${this.extra.inviteEmail}`
      case GameActivityType.INVITE_ACCEPTED:
        return `${this.user.username} joined the organisation`
      case GameActivityType.DATA_EXPORT_REQUESTED:
        return `${this.user.username} requested a data export`
      case GameActivityType.GAME_INTEGRATION_ADDED:
        return `${this.user.username} enabled the ${upperFirst(this.extra.integrationType as string)}} integration`
      case GameActivityType.GAME_INTEGRATION_UPDATED:
        return `${this.user.username} updated the ${upperFirst(this.extra.integrationType as string)} integration`
      case GameActivityType.GAME_INTEGRATION_DELETED:
        return `${this.user.username} disabled the ${upperFirst(this.extra.integrationType as string)} integration`
      case GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED:
        return `${this.user.username} initiated a manual sync for Steamworks leaderboards`
      case GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED:
        return `${this.user.username} initiated a manual sync for Steamworks stats`
      case GameActivityType.PLAYER_GROUP_CREATED:
        return `${this.user.username} created the group ${this.extra.groupName}`
      case GameActivityType.PLAYER_GROUP_UPDATED:
        return `${this.user.username} updated the group ${this.extra.groupName}`
      case GameActivityType.PLAYER_GROUP_DELETED:
        return `${this.user.username} deleted the group ${this.extra.groupName}`
      case GameActivityType.GAME_PROPS_UPDATED:
        return `${this.user.username} updated the live config`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_CREATED:
        return `${this.user.username} created the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED:
        return `${this.user.username} updated the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_DELETED:
        return `${this.user.username} deleted the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.API_KEY_UPDATED:
        return `${this.user.username} updated an access key`
      case GameActivityType.GAME_NAME_UPDATED:
        return `${this.user.username} updated the game name`
      case GameActivityType.PLAYER_STAT_UPDATED:
        return `${this.user.username} updated a player stat value`
      case GameActivityType.LEADERBOARD_ENTRY_UPDATED:
        return `${this.user.username} updated a leaderboard entry`
      case GameActivityType.GAME_CHANNEL_CREATED:
        return `${this.user.username} created a channel`
      case GameActivityType.GAME_CHANNEL_UPDATED:
        return `${this.user.username} updated a channel`
      case GameActivityType.GAME_CHANNEL_DELETED:
        return `${this.user.username} deleted a channel`
      case GameActivityType.INACTIVE_DEV_PLAYERS_DELETED:
        return `${this.extra.count} inactive dev players were deleted`
      case GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED:
        return `${this.extra.count} inactive players were deleted`
      case GameActivityType.LEADERBOARD_ENTRIES_RESET:
        return `${this.user.username} reset the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.GAME_STAT_RESET:
        return `${this.user.username} reset the stat ${this.extra.statInternalName}`
      case GameActivityType.PLAYER_DELETED:
        return `${this.user.username} deleted a player`
      case GameActivityType.GAME_SETTINGS_UPDATED:
        return `${this.user.username} updated game settings`
      default:
        return ''
    }
  }
  /* v8 ignore stop */

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.getActivity(),
      extra: this.extra.display,
      createdAt: this.createdAt,
    }
  }
}
