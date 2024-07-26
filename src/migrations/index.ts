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
import { CreateIntegrationsTable } from './20220717215205CreateIntegrationsTable'
import { CreateSteamIntegrationTables } from './20220723122554CreateSteamIntegrationTables'
import { PlayerAliasServiceUseEnum } from './20220730134520PlayerAliasServiceUseEnum'
import { CreatePlayerPropsTable } from './20220910200720CreatePlayerPropsTable'
import { CreatePlayerGroupsTables } from './20220914003848CreatePlayerGroupsTables'
import { AddFailedJobStackColumn } from './20221113222058AddFailedJobStackColumn copy'
import { DropSteamworksLeaderboardMappingUnique } from './20221113223142DropSteamworksLeaderboardMappingUnique'
import { UpdateTableDefaultValues } from './20230205220923UpdateTableDefaultValues'
import { CreateGameSecretsTable } from './20230205220924CreateGameSecretsTable'
import { AddAPIKeyLastUsedAtColumn } from './20230205220925AddAPIKeyLastUsedAtColumn'
import { CreateGameFeedbackAndCategoryTables } from './20240606165637CreateGameFeedbackAndCategoryTables'
import { AddAPIKeyUpdatedAtColumn } from './20240614122547AddAPIKeyUpdatedAtColumn'
import { CreatePlayerAuthTable } from './20240628155142CreatePlayerAuthTable'
import { CreatePlayerAuthActivityTable } from './20240725183402CreatePlayerAuthActivityTable'

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
  },
  {
    name: 'CreateIntegrationsTable',
    class: CreateIntegrationsTable
  },
  {
    name: 'CreateSteamIntegrationTables',
    class: CreateSteamIntegrationTables
  },
  {
    name: 'PlayerAliasServiceUseEnum',
    class: PlayerAliasServiceUseEnum
  },
  {
    name: 'CreatePlayerPropsTable',
    class: CreatePlayerPropsTable
  },
  {
    name: 'CreatePlayerGroupsTables',
    class: CreatePlayerGroupsTables
  },
  {
    name: 'AddFailedJobStackColumn',
    class: AddFailedJobStackColumn
  },
  {
    name: 'DropSteamworksLeaderboardMappingUnique',
    class: DropSteamworksLeaderboardMappingUnique
  },
  {
    name: 'UpdateTableDefaultValues',
    class: UpdateTableDefaultValues
  },
  {
    name: 'CreateGameSecretsTable',
    class: CreateGameSecretsTable
  },
  {
    name: 'AddAPIKeyLastUsedAtColumn',
    class: AddAPIKeyLastUsedAtColumn
  },
  {
    name: 'CreateGameFeedbackAndCategoryTables',
    class: CreateGameFeedbackAndCategoryTables
  },
  {
    name: 'AddAPIKeyUpdatedAtColumn',
    class: AddAPIKeyUpdatedAtColumn
  },
  {
    name: 'CreatePlayerAuthTable',
    class: CreatePlayerAuthTable
  },
  {
    name: 'CreatePlayerAuthActivityTable',
    class: CreatePlayerAuthActivityTable
  }
]
