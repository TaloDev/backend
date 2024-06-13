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
import Event from './event'
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
import PricingPlanAction from './pricing-plan-action'
import OrganisationPricingPlan from './organisation-pricing-plan'
import OrganisationPricingPlanAction from './organisation-pricing-plan-action'
import Integration from './integration'
import SteamworksIntegrationEvent from './steamworks-integration-event'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping'
import PlayerProp from './player-prop'
import PlayerGroup from './player-group'
import GameSecret from './game-secret'

export default [
  GameFeedback,
  GameSecret,
  PlayerGroup,
  PlayerProp,
  SteamworksLeaderboardMapping,
  SteamworksIntegrationEvent,
  Integration,
  OrganisationPricingPlanAction,
  OrganisationPricingPlan,
  PricingPlanAction,
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
  Event,
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
