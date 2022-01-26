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

export default [
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
