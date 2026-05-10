import APIKey from './api-key.js'
import DataExport from './data-export.js'
import FailedJob from './failed-job.js'
import GameActivity from './game-activity.js'
import GameCenterIntegrationEvent from './game-center-integration-event.js'
import GameChannelProp from './game-channel-prop.js'
import GameChannelStorageProp from './game-channel-storage-prop.js'
import GameChannel from './game-channel.js'
import GameFeedbackProp from './game-feedback-prop.js'
import GameFeedback from './game-feedback.js'
import GameSave from './game-save.js'
import GameSecret from './game-secret.js'
import GameStat from './game-stat.js'
import Game from './game.js'
import GooglePlayGamesIntegrationEvent from './google-play-games-integration-event.js'
import Integration from './integration.js'
import Invite from './invite.js'
import LeaderboardEntryProp from './leaderboard-entry-prop.js'
import LeaderboardEntry from './leaderboard-entry.js'
import Leaderboard from './leaderboard.js'
import OrganisationPricingPlan from './organisation-pricing-plan.js'
import Organisation from './organisation.js'
import PlayerAliasSubscription from './player-alias-subscription.js'
import PlayerAlias from './player-alias.js'
import PlayerAuthActivity from './player-auth-activity.js'
import PlayerAuth from './player-auth.js'
import PlayerGameStat from './player-game-stat.js'
import PlayerGroup from './player-group.js'
import PlayerPresence from './player-presence.js'
import PlayerProp from './player-prop.js'
import { PlayerToDelete } from './player-to-delete.js'
import Player from './player.js'
import PricingPlan from './pricing-plan.js'
import Prop from './prop.js'
import SteamworksIntegrationEvent from './steamworks-integration-event.js'
import { SteamworksLeaderboardEntry } from './steamworks-leaderboard-entry.js'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping.js'
import { SteamworksPlayerStat } from './steamworks-player-stat.js'
import UserAccessCode from './user-access-code.js'
import UserPinnedGroup from './user-pinned-group.js'
import UserRecoveryCode from './user-recovery-code.js'
import UserSession from './user-session.js'
import UserTwoFactorAuth from './user-two-factor-auth.js'
import User from './user.js'

export const entities = [
  GameCenterIntegrationEvent,
  GooglePlayGamesIntegrationEvent,
  PlayerAliasSubscription,
  PlayerToDelete,
  SteamworksPlayerStat,
  SteamworksLeaderboardEntry,
  GameFeedbackProp,
  GameChannelStorageProp,
  GameChannelProp,
  LeaderboardEntryProp,
  PlayerPresence,
  GameChannel,
  UserPinnedGroup,
  PlayerAuthActivity,
  PlayerAuth,
  GameFeedback,
  GameSecret,
  PlayerGroup,
  PlayerProp,
  SteamworksLeaderboardMapping,
  SteamworksIntegrationEvent,
  Integration,
  OrganisationPricingPlan,
  PricingPlan,
  Invite,
  PlayerGameStat,
  GameStat,
  GameActivity,
  GameSave,
  UserRecoveryCode,
  UserTwoFactorAuth,
  Leaderboard,
  LeaderboardEntry,
  DataExport,
  APIKey,
  Game,
  FailedJob,
  Organisation,
  PlayerAlias,
  Player,
  Prop,
  UserAccessCode,
  UserSession,
  User,
]
