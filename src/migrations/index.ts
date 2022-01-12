import { InitialMigration } from './20210725211129InitialMigration'
import { CreateDataExportsTable } from './20210926160859CreateDataExportsTable'
import { CreateLeaderboardsTable } from './20211107233610CreateLeaderboardsTable'
import { CreateUserTwoFactorAuthTable } from './20211205171927CreateUserTwoFactorAuthTable'
import { CreateUserRecoveryCodeTable } from './20211209003017CreateUserRecoveryCodeTable'
import { CascadeDeletePlayerAliasEvents } from './20211221195514CascadeDeletePlayerAliasEvents'
import { AddLeaderboardEntryHiddenColumn } from './20211224154919AddLeaderboardEntryHiddenColumn'
import { CreateGameSavesTable } from './20220109144435CreateGameSavesTable'

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
  }
]
