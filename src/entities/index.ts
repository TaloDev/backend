import Invite from './invite.js'
import PlayerGameStat from './player-game-stat.js'
import GameStat from './game-stat.js'
import GameActivity from './game-activity.js'
import GameSave from './game-save.js'
import Leaderboard from './leaderboard.js'
import LeaderboardEntry from './leaderboard-entry.js'
import APIKey from './api-key.js'
import DataExport from './data-export.js'
import Event from './event.js'
import FailedJob from './failed-job.js'
import Game from './game.js'
import Organisation from './organisation.js'
import Player from './player.js'
import PlayerAlias from './player-alias.js'
import Prop from './prop.js'
import User from './user.js'
import UserAccessCode from './user-access-code.js'
import UserSession from './user-session.js'
import UserTwoFactorAuth from './user-two-factor-auth.js'
import UserRecoveryCode from './user-recovery-code.js'
import PricingPlan from './pricing-plan.js'
import PricingPlanAction from './pricing-plan-action.js'
import OrganisationPricingPlan from './organisation-pricing-plan.js'
import OrganisationPricingPlanAction from './organisation-pricing-plan-action.js'
import Integration from './integration.js'
import SteamworksIntegrationEvent from './steamworks-integration-event.js'
import SteamworksLeaderboardMapping from './steamworks-leaderboard-mapping.js'
import PlayerProp from './player-prop.js'
import PlayerGroup from './player-group.js'
import GameSecret from './game-secret.js'

export default [
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
