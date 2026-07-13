import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { startCase } from 'lodash-es'
import AdminAPIKey from './admin-api-key.js'
import Game from './game.js'
import User from './user.js'

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
  GAME_FEEDBACK_ARCHIVED,
  GAME_FEEDBACK_RESTORED,
  GAME_FEEDBACK_CATEGORY_RESET,
  ORGANISATION_MEMBER_REMOVED,
  PLAYER_DEV_BUILD_TOGGLED,
  VERIFICATION_KEY_CREATED,
  VERIFICATION_KEY_DELETED,
  ADMIN_API_KEY_CREATED,
  ADMIN_API_KEY_REVOKED,
  ADMIN_API_KEY_UPDATED,
}

@Entity()
export default class GameActivity {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Game, { nullable: true })
  game: Game | null = null

  @ManyToOne(() => User, { nullable: true })
  user: User | null = null

  @ManyToOne(() => AdminAPIKey, { nullable: true })
  adminAPIKey: AdminAPIKey | null = null

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

  constructor(game: Game | null, actor: User | AdminAPIKey) {
    this.game = game
    if (actor instanceof User) {
      this.user = actor
    } else {
      this.adminAPIKey = actor
    }
  }

  /* v8 ignore start -- @preserve */
  private actor() {
    if (this.user) {
      return this.user.username
    }
    if (this.adminAPIKey) {
      return `Key ending in ${this.adminAPIKey.keyEnding}`
    }
    return 'System'
  }
  /* v8 ignore stop -- @preserve */

  /* v8 ignore start -- @preserve */
  private getActivity(): string {
    switch (this.type) {
      case GameActivityType.PLAYER_PROPS_UPDATED:
        return `${this.actor()} updated a player's props`
      case GameActivityType.LEADERBOARD_CREATED:
        return `${this.actor()} created the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_UPDATED:
        return `${this.actor()} updated the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_DELETED:
        return `${this.actor()} deleted the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_HIDDEN:
        return `${this.actor()} hid a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.LEADERBOARD_ENTRY_RESTORED:
        return `${this.actor()} restored a leaderboard entry in ${this.extra.leaderboardInternalName}`
      case GameActivityType.API_KEY_CREATED:
        return `${this.actor()} created an access key`
      case GameActivityType.API_KEY_REVOKED:
        return `${this.actor()} revoked an access key`
      case GameActivityType.GAME_STAT_CREATED:
        return `${this.actor()} created the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_UPDATED:
        return `${this.actor()} updated the stat ${this.extra.statInternalName}`
      case GameActivityType.GAME_STAT_DELETED:
        return `${this.actor()} deleted the stat ${this.extra.statInternalName}`
      case GameActivityType.INVITE_CREATED:
        return `${this.actor()} created an invite for ${this.extra.inviteEmail}`
      case GameActivityType.INVITE_ACCEPTED:
        return `${this.actor()} joined the organisation`
      case GameActivityType.DATA_EXPORT_REQUESTED:
        return `${this.actor()} requested a data export`
      case GameActivityType.GAME_INTEGRATION_ADDED:
        return `${this.actor()} enabled the ${startCase(this.extra.integrationType as string)} integration`
      case GameActivityType.GAME_INTEGRATION_UPDATED:
        return `${this.actor()} updated the ${startCase(this.extra.integrationType as string)} integration`
      case GameActivityType.GAME_INTEGRATION_DELETED:
        return `${this.actor()} disabled the ${startCase(this.extra.integrationType as string)} integration`
      case GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED:
        return `${this.actor()} initiated a manual sync for Steamworks leaderboards`
      case GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED:
        return `${this.actor()} initiated a manual sync for Steamworks stats`
      case GameActivityType.PLAYER_GROUP_CREATED:
        return `${this.actor()} created the group ${this.extra.groupName}`
      case GameActivityType.PLAYER_GROUP_UPDATED:
        return `${this.actor()} updated the group ${this.extra.groupName}`
      case GameActivityType.PLAYER_GROUP_DELETED:
        return `${this.actor()} deleted the group ${this.extra.groupName}`
      case GameActivityType.GAME_PROPS_UPDATED:
        return `${this.actor()} updated the live config`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_CREATED:
        return `${this.actor()} created the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED:
        return `${this.actor()} updated the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_DELETED:
        return `${this.actor()} deleted the feedback category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.API_KEY_UPDATED:
        return `${this.actor()} updated an access key`
      case GameActivityType.GAME_NAME_UPDATED:
        return `${this.actor()} updated the game name`
      case GameActivityType.PLAYER_STAT_UPDATED:
        return `${this.actor()} updated a player stat value`
      case GameActivityType.LEADERBOARD_ENTRY_UPDATED:
        return `${this.actor()} updated a leaderboard entry`
      case GameActivityType.GAME_CHANNEL_CREATED:
        return `${this.actor()} created a channel`
      case GameActivityType.GAME_CHANNEL_UPDATED:
        return `${this.actor()} updated a channel`
      case GameActivityType.GAME_CHANNEL_DELETED:
        return `${this.actor()} deleted a channel`
      case GameActivityType.INACTIVE_DEV_PLAYERS_DELETED:
        return `${this.extra.count} inactive dev players were deleted`
      case GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED:
        return `${this.extra.count} inactive players were deleted`
      case GameActivityType.LEADERBOARD_ENTRIES_RESET:
        return `${this.actor()} reset the leaderboard ${this.extra.leaderboardInternalName}`
      case GameActivityType.GAME_STAT_RESET:
        return `${this.actor()} reset the stat ${this.extra.statInternalName}`
      case GameActivityType.PLAYER_DELETED:
        return `${this.actor()} deleted a player`
      case GameActivityType.GAME_SETTINGS_UPDATED:
        return `${this.actor()} updated game settings`
      case GameActivityType.GAME_FEEDBACK_ARCHIVED:
        return `${this.actor()} archived feedback from ${(this.extra.aliasIdentifier as string | null) ?? 'an anonymous player'}`
      case GameActivityType.GAME_FEEDBACK_RESTORED:
        return `${this.actor()} restored feedback from ${(this.extra.aliasIdentifier as string | null) ?? 'an anonymous player'}`
      case GameActivityType.GAME_FEEDBACK_CATEGORY_RESET:
        return `${this.actor()} reset feedback for the category ${this.extra.feedbackCategoryInternalName}`
      case GameActivityType.ORGANISATION_MEMBER_REMOVED:
        return `${this.actor()} removed ${this.extra.removedUsername} from the organisation`
      case GameActivityType.PLAYER_DEV_BUILD_TOGGLED:
        return `${this.actor()} toggled a player's dev build status`
      case GameActivityType.VERIFICATION_KEY_CREATED:
        return `${this.actor()} created a verification key version ${this.extra.version}`
      case GameActivityType.VERIFICATION_KEY_DELETED:
        return `${this.actor()} deleted verification key version ${this.extra.version}`
      case GameActivityType.ADMIN_API_KEY_CREATED:
        return `${this.actor()} created an admin API key`
      case GameActivityType.ADMIN_API_KEY_REVOKED:
        return `${this.actor()} revoked an admin API key`
      case GameActivityType.ADMIN_API_KEY_UPDATED:
        return `${this.actor()} updated an admin API key`
      default:
        return ''
    }
  }
  /* v8 ignore stop -- @preserve */

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
