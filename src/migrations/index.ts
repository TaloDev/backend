import { InitialMigration } from './20210725211129InitialMigration'
import { CreateDataExportsTable } from './20210926160859CreateDataExportsTable'
import { CreateLeaderboardsTable } from './20211107233610CreateLeaderboardsTable'
import { CreateUserTwoFactorAuthTable } from './20211205171927CreateUserTwoFactorAuthTable'
import { CreateUserRecoveryCodeTable } from './20211209003017CreateUserRecoveryCodeTable'
import { CascadeDeletePlayerAliasEvents } from './20211221195514CascadeDeletePlayerAliasEvents'
import { AddLeaderboardEntryHiddenColumn } from './20211224154919AddLeaderboardEntryHiddenColumn'
import { CreateGameSavesTable } from './20220109144435CreateGameSavesTable'
import { CreateGameActivitiesTable } from './20220125220401CreateGameActivitiesTable'
import { SetUserTwoFactorAuthEnabledDefaultFalse } from './20220203130919SetUserTwoFactorAuthEnabledDefaultFalse'
import { CreateGameStatsTable } from './20220320171104CreateGameStatsTable'
import { AddUsernameColumn } from './20220402004932AddUsernameColumn'
import { CreateInvitesTable } from './20220420141136CreateInvitesTable'
import { MakeGameActivityUserNullable } from './20220505190243MakeGameActivityUserNullable'
import { CreatePricingPlansTable } from './20220603123117CreatePricingPlansTable'

export default [
  {
    name: 'InitialMigration',
    class: InitialMigration
  },
  {
    name: 'CreateDataExportsTable',
    class: CreateDataExportsTable
  },
  {
    name: 'CreateLeaderboardsTable',
    class: CreateLeaderboardsTable
  },
  {
    name: 'CreateUserTwoFactorAuthTable',
    class: CreateUserTwoFactorAuthTable
  },
  {
    name: 'CreateUserRecoveryCodeTable',
    class: CreateUserRecoveryCodeTable
  },
  {
    name: 'CascadeDeletePlayerAliasEvents',
    class: CascadeDeletePlayerAliasEvents
  },
  {
    name: 'AddLeaderboardEntryHiddenColumn',
    class: AddLeaderboardEntryHiddenColumn
  },
  {
    name: 'CreateGameSavesTable',
    class: CreateGameSavesTable
  },
  {
    name: 'CreateGameActivitiesTable',
    class: CreateGameActivitiesTable
  },
  {
    name: 'SetUserTwoFactorAuthEnabledDefaultFalse',
    class: SetUserTwoFactorAuthEnabledDefaultFalse
  },
  {
    name: 'CreateGameStatsTable',
    class: CreateGameStatsTable
  },
  {
    name: 'AddUsernameColumn',
    class: AddUsernameColumn
  },
  {
    name: 'CreateInvitesTable',
    class: CreateInvitesTable
  },
  {
    name: 'MakeGameActivityUserNullable',
    class: MakeGameActivityUserNullable
  },
  {
    name: 'CreatePricingPlansTable',
    class: CreatePricingPlansTable
  }
]
