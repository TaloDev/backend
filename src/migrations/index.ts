import { InitialMigration } from './20210725211129InitialMigration.js'
import { CreateDataExportsTable } from './20210926160859CreateDataExportsTable.js'
import { CreateLeaderboardsTable } from './20211107233610CreateLeaderboardsTable.js'
import { CreateUserTwoFactorAuthTable } from './20211205171927CreateUserTwoFactorAuthTable.js'
import { CreateUserRecoveryCodeTable } from './20211209003017CreateUserRecoveryCodeTable.js'
import { CascadeDeletePlayerAliasEvents } from './20211221195514CascadeDeletePlayerAliasEvents.js'
import { AddLeaderboardEntryHiddenColumn } from './20211224154919AddLeaderboardEntryHiddenColumn.js'
import { CreateGameSavesTable } from './20220109144435CreateGameSavesTable.js'
import { CreateGameActivitiesTable } from './20220125220401CreateGameActivitiesTable.js'
import { SetUserTwoFactorAuthEnabledDefaultFalse } from './20220203130919SetUserTwoFactorAuthEnabledDefaultFalse.js'
import { CreateGameStatsTable } from './20220320171104CreateGameStatsTable.js'
import { AddUsernameColumn } from './20220402004932AddUsernameColumn.js'
import { CreateInvitesTable } from './20220420141136CreateInvitesTable.js'
import { MakeGameActivityUserNullable } from './20220505190243MakeGameActivityUserNullable.js'
import { CreatePricingPlansTable } from './20220603123117CreatePricingPlansTable.js'
import { CreateIntegrationsTable } from './20220717215205CreateIntegrationsTable.js'
import { CreateSteamIntegrationTables } from './20220723122554CreateSteamIntegrationTables.js'
import { PlayerAliasServiceUseEnum } from './20220730134520PlayerAliasServiceUseEnum.js'
import { CreatePlayerPropsTable } from './20220910200720CreatePlayerPropsTable.js'
import { CreatePlayerGroupsTables } from './20220914003848CreatePlayerGroupsTables.js'
import { AddFailedJobStackColumn } from './20221113222058AddFailedJobStackColumn copy.js'
import { DropSteamworksLeaderboardMappingUnique } from './20221113223142DropSteamworksLeaderboardMappingUnique.js'
import { UpdateTableDefaultValues } from './20230205220923UpdateTableDefaultValues.js'
import { CreateGameSecretsTable } from './20230205220924CreateGameSecretsTable.js'
import { AddAPIKeyLastUsedAtColumn } from './20230205220925AddAPIKeyLastUsedAtColumn.js'

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
  }
]
