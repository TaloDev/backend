import { InitialMigration } from './20210725211129InitialMigration.js'
import { CreateDataExportsTable } from './20210926160859CreateDataExportsTable.js'
import { CreateLeaderboardsTable } from './20211107233610CreateLeaderboardsTable.js'
import { CreateUserTwoFactorAuthTable } from './20211205171927CreateUserTwoFactorAuthTable.js'
import { CreateUserRecoveryCodeTable } from './20211209003017CreateUserRecoveryCodeTable.js'
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
import { AddFailedJobStackColumn } from './20221113222058AddFailedJobStackColumn.js'
import { DropSteamworksLeaderboardMappingUnique } from './20221113223142DropSteamworksLeaderboardMappingUnique.js'
import { UpdateTableDefaultValues } from './20230205220923UpdateTableDefaultValues.js'
import { CreateGameSecretsTable } from './20230205220924CreateGameSecretsTable.js'
import { AddAPIKeyLastUsedAtColumn } from './20230205220925AddAPIKeyLastUsedAtColumn.js'
import { CreateGameFeedbackAndCategoryTables } from './20240606165637CreateGameFeedbackAndCategoryTables.js'
import { AddAPIKeyUpdatedAtColumn } from './20240614122547AddAPIKeyUpdatedAtColumn.js'
import { CreatePlayerAuthTable } from './20240628155142CreatePlayerAuthTable.js'
import { CreatePlayerAuthActivityTable } from './20240725183402CreatePlayerAuthActivityTable.js'
import { UpdatePlayerAliasServiceColumn } from './20240916213402UpdatePlayerAliasServiceColumn.js'
import { AddPlayerAliasAnonymisedColumn } from './20240920121232AddPlayerAliasAnonymisedColumn.js'
import { AddLeaderboardEntryPropsColumn } from './20240922222426AddLeaderboardEntryPropsColumn.js'
import { CreateUserPinnedGroupsTable } from './20241001194252CreateUserPinnedGroupsTable.js'
import { AddPlayerGroupMembersVisibleColumn } from './20241014202844AddPlayerGroupMembersVisibleColumn.js'
import { AddPlayerPropCreatedAtColumn } from './20241101233908AddPlayerPropCreatedAtColumn.js'
import { AddPlayerAliasLastSeenAtColumn } from './20241102004938AddPlayerAliasLastSeenAtColumn.js'
import { CreateGameChannelTables } from './20241206233511CreateGameChannelTables.js'
import { IncreasePlayerAliasIdentifierLength } from './20241221210019IncreasePlayerAliasIdentifierLength.js'
import { DropPlanActionTablesAddPlayerLimit } from './20250126082032DropPlanActionTablesAddPlayerLimit.js'
import { AddLeaderboardRefreshIntervalAndEntryDeletedAt } from './20250212031914AddLeaderboardRefreshIntervalAndEntryDeletedAt.js'
import { CreatePlayerPresenceTable } from './20250213081652CreatePlayerPresenceTable.js'
import { DeletePlayerAliasAnonymisedColumn } from './20250217004535DeletePlayerAliasAnonymisedColumn.js'
import { CascadePlayerPresenceAlias } from './20250219233504CascadePlayerPresenceAlias.js'
import { ModifyPlayerPropLengths } from './20250402161623ModifyPlayerPropLengths.js'
import { AddGameChannelPrivateColumn } from './20250411180623AddGameChannelPrivateColumn.js'
import { CreateLeaderboardEntryPropTable } from './20250505131919CreateLeaderboardEntryPropTable.js'
import { AddCascadeDeleteRules } from './20250512220859AddCascadeDeleteRules.js'
import { AddPurgeAndWebsiteGameColumns } from './20250513222143AddPurgeAndWebsiteGameColumns.js'
import { CreateGameChannelPropTable } from './20250518214836CreateGameChannelPropTable.js'
import { AddGameChannelTemporaryMembershipColumn } from './20250522212229AddGameChannelTemporaryMembershipColumn.js'
import { CreateGameChannelStoragePropTable } from './20250531223353CreateGameChannelStoragePropTable.js'
import { AddPlayerGroupQueryIndexes } from './20250705074341AddPlayerGroupQueryIndexes.js'
import { AddPurgeRetentionDaysColumns } from './20250709083216AddPurgeRetentionDaysColumns.js'
import { CreateGameFeedbackPropTable } from './20250719225216CreateGameFeedbackPropTable.js'
import { AddPlayerDevBuildColumn } from './20250725144253AddPlayerDevBuildColumn.js'
import { PlayerAliasIdentifierServiceIndex } from './20250811004719PlayerAliasIdentifierServiceIndex.js'
import { InternalNameGameIndexes } from './20250811115700InternalNameGameIndexes.js'
import { CreateSteamworksLeaderboardEntryTable } from './20250912193820CreateSteamworksLeaderboardEntryTable.js'
import { CreateSteamworksPlayerStatTable } from './20250915220838CreateSteamworksPlayerStatTable.js'
import { AddGameChannelStoragePropKeyIndex } from './20250923194349AddGameChannelStoragePropKeyIndex.js'
import { AddLeaderboardUniqueByPropsColumn } from './20251015211635AddLeaderboardUniqueByPropsColumn.js'
import { AddLeaderboardEntryPropsDigestColumn } from './20251019231730AddLeaderboardEntryPropsDigestColumn.js'
import { CreatePlayersToDeleteTable } from './20251102174957CreatePlayersToDeleteTable.js'
import { CreatePlayerAliasSubscriptionTable } from './20251222221535CreatePlayerAliasSubscriptionTable.js'
import { AddPlayerGameStatUniqueConstraint } from './20260214224025AddPlayerGameStatUniqueConstraint.js'
import { AddGameFeedbackDeletedAtColumn } from './20260301000000AddGameFeedbackDeletedAtColumn.js'
import { CreateGooglePlayGamesIntegrationEventTable } from './20260306091456CreateGooglePlayGamesIntegrationEventTable.js'
import { AddLastUsageWarningThresholdColumn } from './20260327081802AddLastUsageWarningThresholdColumn.js'
import { SchemaSnapshotChanges } from './20260327224537SchemaSnapshotChanges.js'
import { AddFailedJobFailedAtIndex } from './20260327225535AddFailedJobFailedAtIndex.js'
import { CreateGameCenterIntegrationEventTable } from './20260404213749CreateGameCenterIntegrationEventTable.js'
import { MikroORMV7FKDecouple } from './20260509215853MikroORMV7FKDecouple.js'
import { AddBlockAliasIdentifierProfanityColumn } from './20260514072111AddBlockAliasIdentifierProfanityColumn.js'

export default [
  {
    name: 'InitialMigration',
    class: InitialMigration,
  },
  {
    name: 'CreateDataExportsTable',
    class: CreateDataExportsTable,
  },
  {
    name: 'CreateLeaderboardsTable',
    class: CreateLeaderboardsTable,
  },
  {
    name: 'CreateUserTwoFactorAuthTable',
    class: CreateUserTwoFactorAuthTable,
  },
  {
    name: 'CreateUserRecoveryCodeTable',
    class: CreateUserRecoveryCodeTable,
  },
  {
    name: 'AddLeaderboardEntryHiddenColumn',
    class: AddLeaderboardEntryHiddenColumn,
  },
  {
    name: 'CreateGameSavesTable',
    class: CreateGameSavesTable,
  },
  {
    name: 'CreateGameActivitiesTable',
    class: CreateGameActivitiesTable,
  },
  {
    name: 'SetUserTwoFactorAuthEnabledDefaultFalse',
    class: SetUserTwoFactorAuthEnabledDefaultFalse,
  },
  {
    name: 'CreateGameStatsTable',
    class: CreateGameStatsTable,
  },
  {
    name: 'AddUsernameColumn',
    class: AddUsernameColumn,
  },
  {
    name: 'CreateInvitesTable',
    class: CreateInvitesTable,
  },
  {
    name: 'MakeGameActivityUserNullable',
    class: MakeGameActivityUserNullable,
  },
  {
    name: 'CreatePricingPlansTable',
    class: CreatePricingPlansTable,
  },
  {
    name: 'CreateIntegrationsTable',
    class: CreateIntegrationsTable,
  },
  {
    name: 'CreateSteamIntegrationTables',
    class: CreateSteamIntegrationTables,
  },
  {
    name: 'PlayerAliasServiceUseEnum',
    class: PlayerAliasServiceUseEnum,
  },
  {
    name: 'CreatePlayerPropsTable',
    class: CreatePlayerPropsTable,
  },
  {
    name: 'CreatePlayerGroupsTables',
    class: CreatePlayerGroupsTables,
  },
  {
    name: 'AddFailedJobStackColumn',
    class: AddFailedJobStackColumn,
  },
  {
    name: 'DropSteamworksLeaderboardMappingUnique',
    class: DropSteamworksLeaderboardMappingUnique,
  },
  {
    name: 'UpdateTableDefaultValues',
    class: UpdateTableDefaultValues,
  },
  {
    name: 'CreateGameSecretsTable',
    class: CreateGameSecretsTable,
  },
  {
    name: 'AddAPIKeyLastUsedAtColumn',
    class: AddAPIKeyLastUsedAtColumn,
  },
  {
    name: 'CreateGameFeedbackAndCategoryTables',
    class: CreateGameFeedbackAndCategoryTables,
  },
  {
    name: 'AddAPIKeyUpdatedAtColumn',
    class: AddAPIKeyUpdatedAtColumn,
  },
  {
    name: 'CreatePlayerAuthTable',
    class: CreatePlayerAuthTable,
  },
  {
    name: 'CreatePlayerAuthActivityTable',
    class: CreatePlayerAuthActivityTable,
  },
  {
    name: 'UpdatePlayerAliasServiceColumn',
    class: UpdatePlayerAliasServiceColumn,
  },
  {
    name: 'AddPlayerAliasAnonymisedColumn',
    class: AddPlayerAliasAnonymisedColumn,
  },
  {
    name: 'AddLeaderboardEntryPropsColumn',
    class: AddLeaderboardEntryPropsColumn,
  },
  {
    name: 'CreateUserPinnedGroupsTable',
    class: CreateUserPinnedGroupsTable,
  },
  {
    name: 'AddPlayerGroupMembersVisibleColumn',
    class: AddPlayerGroupMembersVisibleColumn,
  },
  {
    name: 'AddPlayerPropCreatedAtColumn',
    class: AddPlayerPropCreatedAtColumn,
  },
  {
    name: 'AddPlayerAliasLastSeenAtColumn',
    class: AddPlayerAliasLastSeenAtColumn,
  },
  {
    name: 'CreateGameChannelTables',
    class: CreateGameChannelTables,
  },
  {
    name: 'IncreasePlayerAliasIdentifierLength',
    class: IncreasePlayerAliasIdentifierLength,
  },
  {
    name: 'DropPlanActionTablesAddPlayerLimit',
    class: DropPlanActionTablesAddPlayerLimit,
  },
  {
    name: 'AddLeaderboardRefreshIntervalAndEntryDeletedAt',
    class: AddLeaderboardRefreshIntervalAndEntryDeletedAt,
  },
  {
    name: 'DeletePlayerAliasAnonymisedColumn',
    class: DeletePlayerAliasAnonymisedColumn,
  },
  {
    name: 'CreatePlayerPresenceTable',
    class: CreatePlayerPresenceTable,
  },
  {
    name: 'CascadePlayerPresenceAlias',
    class: CascadePlayerPresenceAlias,
  },
  {
    name: 'ModifyPlayerPropLengths',
    class: ModifyPlayerPropLengths,
  },
  {
    name: 'AddGameChannelPrivateColumn',
    class: AddGameChannelPrivateColumn,
  },
  {
    name: 'CreateLeaderboardEntryPropTable',
    class: CreateLeaderboardEntryPropTable,
  },
  {
    name: 'AddCascadeDeleteRules',
    class: AddCascadeDeleteRules,
  },
  {
    name: 'AddPurgeAndWebsiteGameColumns',
    class: AddPurgeAndWebsiteGameColumns,
  },
  {
    name: 'CreateGameChannelPropTable',
    class: CreateGameChannelPropTable,
  },
  {
    name: 'AddGameChannelTemporaryMembershipColumn',
    class: AddGameChannelTemporaryMembershipColumn,
  },
  {
    name: 'CreateGameChannelStoragePropTable',
    class: CreateGameChannelStoragePropTable,
  },
  {
    name: 'AddPlayerGroupQueryIndexes',
    class: AddPlayerGroupQueryIndexes,
  },
  {
    name: 'AddPurgeRetentionDaysColumns',
    class: AddPurgeRetentionDaysColumns,
  },
  {
    name: 'CreateGameFeedbackPropTable',
    class: CreateGameFeedbackPropTable,
  },
  {
    name: 'AddPlayerDevBuildColumn',
    class: AddPlayerDevBuildColumn,
  },
  {
    name: 'PlayerAliasIdentifierServiceIndex',
    class: PlayerAliasIdentifierServiceIndex,
  },
  {
    name: 'InternalNameGameIndexes',
    class: InternalNameGameIndexes,
  },
  {
    name: 'CreateSteamworksLeaderboardEntryTable',
    class: CreateSteamworksLeaderboardEntryTable,
  },
  {
    name: 'CreateSteamworksPlayerStatTable',
    class: CreateSteamworksPlayerStatTable,
  },
  {
    name: 'AddGameChannelStoragePropKeyIndex',
    class: AddGameChannelStoragePropKeyIndex,
  },
  {
    name: 'AddLeaderboardUniqueByPropsColumn',
    class: AddLeaderboardUniqueByPropsColumn,
  },
  {
    name: 'AddLeaderboardEntryPropsDigestColumn',
    class: AddLeaderboardEntryPropsDigestColumn,
  },
  {
    name: 'CreatePlayersToDeleteTable',
    class: CreatePlayersToDeleteTable,
  },
  {
    name: 'CreatePlayerAliasSubscriptionTable',
    class: CreatePlayerAliasSubscriptionTable,
  },
  {
    name: 'AddPlayerGameStatUniqueConstraint',
    class: AddPlayerGameStatUniqueConstraint,
  },
  {
    name: 'AddGameFeedbackDeletedAtColumn',
    class: AddGameFeedbackDeletedAtColumn,
  },
  {
    name: 'CreateGooglePlayGamesIntegrationEventTable',
    class: CreateGooglePlayGamesIntegrationEventTable,
  },
  {
    name: 'AddLastUsageWarningThresholdColumn',
    class: AddLastUsageWarningThresholdColumn,
  },
  {
    name: 'SchemaSnapshotChanges',
    class: SchemaSnapshotChanges,
  },
  {
    name: 'AddFailedJobFailedAtIndex',
    class: AddFailedJobFailedAtIndex,
  },
  {
    name: 'CreateGameCenterIntegrationEventTable',
    class: CreateGameCenterIntegrationEventTable,
  },
  {
    name: 'MikroORMV7FKDecouple',
    class: MikroORMV7FKDecouple,
  },
  {
    name: 'AddBlockAliasIdentifierProfanityColumn',
    class: AddBlockAliasIdentifierProfanityColumn,
  },
]
