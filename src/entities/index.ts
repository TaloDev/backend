import APIKey from './api-key'
import DataExport from './data-export'
import FailedJob from './failed-job'
import Game from './game'
import GameActivity from './game-activity'
import GameChannel from './game-channel'
import GameChannelProp from './game-channel-prop'
import GameChannelStorageProp from './game-channel-storage-prop'
import GameFeedback from './game-feedback'
import GameFeedbackProp from './game-feedback-prop'
import GameSave from './game-save'
import GameSecret from './game-secret'
import GameStat from './game-stat'
import Integration from './integration'
import Invite from './invite'
import Leaderboard from './leaderboard'
import LeaderboardEntry from './leaderboard-entry'
import LeaderboardEntryProp from './leaderboard-entry-prop'
import Organisation from './organisation'
import OrganisationPricingPlan from './organisation-pricing-plan'
import Player from './player'
import PlayerAlias from './player-alias'
import PlayerAliasSubscription from './player-alias-subscription'
import PlayerAuth from './player-auth'
import PlayerAuthActivity from './player-auth-activity'
import PlayerGameStat from './player-game-stat'
import PlayerGroup from './player-group'
import PlayerPresence from './player-presence'
import PlayerProp from './player-prop'
import { PlayerToDelete } from './player-to-delete'
import PricingPlan from './pricing-plan'
import Prop from './prop'
import SteamworksIntegrationEvent from './steamworks-integration-event'
import { SteamworksLeaderboardEntry } from './steamworks-leaderboard-entry'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping'
import { SteamworksPlayerStat } from './steamworks-player-stat'
import User from './user'
import UserAccessCode from './user-access-code'
import UserPinnedGroup from './user-pinned-group'
import UserRecoveryCode from './user-recovery-code'
import UserSession from './user-session'
import UserTwoFactorAuth from './user-two-factor-auth'

export const entities = [
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
