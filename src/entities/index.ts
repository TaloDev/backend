import GameChannel from './game-channel'
import UserPinnedGroup from './user-pinned-group'
import PlayerAuthActivity from './player-auth-activity'
import PlayerAuth from './player-auth'
import GameFeedback from './game-feedback'
import Invite from './invite'
import PlayerGameStat from './player-game-stat'
import GameStat from './game-stat'
import GameActivity from './game-activity'
import GameSave from './game-save'
import Leaderboard from './leaderboard'
import LeaderboardEntry from './leaderboard-entry'
import APIKey from './api-key'
import DataExport from './data-export'
import FailedJob from './failed-job'
import Game from './game'
import Organisation from './organisation'
import Player from './player'
import PlayerAlias from './player-alias'
import Prop from './prop'
import User from './user'
import UserAccessCode from './user-access-code'
import UserSession from './user-session'
import UserTwoFactorAuth from './user-two-factor-auth'
import UserRecoveryCode from './user-recovery-code'
import PricingPlan from './pricing-plan'
import OrganisationPricingPlan from './organisation-pricing-plan'
import Integration from './integration'
import SteamworksIntegrationEvent from './steamworks-integration-event'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping'
import PlayerProp from './player-prop'
import PlayerGroup from './player-group'
import GameSecret from './game-secret'
import PlayerPresence from './player-presence'
import LeaderboardEntryProp from './leaderboard-entry-prop'
import GameChannelProp from './game-channel-prop'
import GameChannelStorageProp from './game-channel-storage-prop'
import GameFeedbackProp from './game-feedback-prop'
import { SteamworksLeaderboardEntry } from './steamworks-leaderboard-entry'
import { SteamworksPlayerStat } from './steamworks-player-stat'

export default [
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
  User
]
