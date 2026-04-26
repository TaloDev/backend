import { Entity, Enum, Filter, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { EntityManager } from '@mikro-orm/mysql'
import { pick } from 'lodash'
import { decrypt, encrypt } from '../lib/crypto/string-encryption'
import {
  authenticateAuthCode,
  AuthenticateAuthCodeResult,
} from '../lib/integrations/google-play-games/google-play-games-players'
import {
  cleanupSteamworksLeaderboardEntry,
  createSteamworksLeaderboard,
  createSteamworksLeaderboardEntry,
  deleteSteamworksLeaderboard,
  deleteSteamworksLeaderboardEntry,
  syncSteamworksLeaderboards,
} from '../lib/integrations/steamworks/steamworks-leaderboards'
import {
  authenticateTicket,
  AuthenticateTicketResult,
} from '../lib/integrations/steamworks/steamworks-players'
import {
  cleanupSteamworksPlayerStat,
  setSteamworksStat,
  syncSteamworksStats,
} from '../lib/integrations/steamworks/steamworks-stats'
import Game from './game'
import Leaderboard from './leaderboard'
import LeaderboardEntry from './leaderboard-entry'
import { PlayerAliasService } from './player-alias'
import PlayerGameStat from './player-game-stat'
import { SteamworksLeaderboardEntry } from './steamworks-leaderboard-entry'
import { SteamworksPlayerStat } from './steamworks-player-stat'

export enum IntegrationType {
  STEAMWORKS = 'steamworks',
  GOOGLE_PLAY_GAMES = 'google-play-games',
}

export type SteamIntegrationConfig = {
  apiKey: string
  appId: number
  syncLeaderboards: boolean
  syncStats: boolean
}

export type GooglePlayGamesIntegrationConfig = {
  clientId: string
  clientSecret: string
}

export type IntegrationConfigMap = {
  [IntegrationType.STEAMWORKS]: SteamIntegrationConfig
  [IntegrationType.GOOGLE_PLAY_GAMES]: GooglePlayGamesIntegrationConfig
}

export type IntegrationConfig = IntegrationConfigMap[keyof IntegrationConfigMap]

@Entity()
@Filter({ name: 'active', cond: { deletedAt: null }, default: true })
export default class Integration<T extends IntegrationType = IntegrationType> {
  @PrimaryKey()
  id!: number

  @Enum(() => IntegrationType)
  type: T

  @ManyToOne(() => Game)
  game: Game

  @Property({ type: 'json' })
  private config: IntegrationConfigMap[T]

  @Property({ nullable: true })
  deletedAt: Date | null = null

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(type: T, game: Game, config: IntegrationConfigMap[T]) {
    this.type = type
    this.game = game

    switch (type) {
      case IntegrationType.STEAMWORKS: {
        const steamConfig = config as SteamIntegrationConfig
        this.config = {
          ...steamConfig,
          apiKey: encrypt(steamConfig.apiKey, process.env.STEAM_INTEGRATION_SECRET!),
        } as IntegrationConfigMap[T]
        break
      }
      case IntegrationType.GOOGLE_PLAY_GAMES: {
        const gpgConfig = config as GooglePlayGamesIntegrationConfig
        this.config = {
          ...gpgConfig,
          clientSecret: encrypt(
            gpgConfig.clientSecret,
            process.env.GOOGLE_PLAY_GAMES_INTEGRATION_SECRET!,
          ),
        } as IntegrationConfigMap[T]
        break
      }
    }
  }

  updateConfig(config: Partial<IntegrationConfigMap[T]>) {
    const mutable = config as Record<string, unknown>
    switch (this.type) {
      case IntegrationType.STEAMWORKS: {
        const steamConfig = config as Partial<SteamIntegrationConfig>
        if (steamConfig.apiKey) {
          mutable.apiKey = encrypt(steamConfig.apiKey, process.env.STEAM_INTEGRATION_SECRET!)
        }
        break
      }
      case IntegrationType.GOOGLE_PLAY_GAMES: {
        const gpgConfig = config as Partial<GooglePlayGamesIntegrationConfig>
        if (gpgConfig.clientSecret) {
          mutable.clientSecret = encrypt(
            gpgConfig.clientSecret,
            process.env.GOOGLE_PLAY_GAMES_INTEGRATION_SECRET!,
          )
        }
        break
      }
    }

    this.config = {
      ...this.config,
      ...config,
    }
  }

  getSteamConfig(): Omit<SteamIntegrationConfig, 'apiKey'> {
    return pick(this.config as SteamIntegrationConfig, ['appId', 'syncLeaderboards', 'syncStats'])
  }

  getGooglePlayGamesConfig(): Omit<GooglePlayGamesIntegrationConfig, 'clientSecret'> {
    return pick(this.config as GooglePlayGamesIntegrationConfig, ['clientId'])
  }

  getConfig():
    | Omit<SteamIntegrationConfig, 'apiKey'>
    | Omit<GooglePlayGamesIntegrationConfig, 'clientSecret'> {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        return this.getSteamConfig()
      case IntegrationType.GOOGLE_PLAY_GAMES:
        return this.getGooglePlayGamesConfig()
    }
  }

  getSteamAPIKey(): string {
    return decrypt(
      (this.config as SteamIntegrationConfig).apiKey,
      process.env.STEAM_INTEGRATION_SECRET!,
    )
  }

  getGooglePlayGamesClientSecret(): string {
    return decrypt(
      (this.config as GooglePlayGamesIntegrationConfig).clientSecret,
      process.env.GOOGLE_PLAY_GAMES_INTEGRATION_SECRET!,
    )
  }

  async handleLeaderboardCreated(em: EntityManager, leaderboard: Leaderboard) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.getSteamConfig().syncLeaderboards) {
          await createSteamworksLeaderboard(em, this, leaderboard)
        }
    }
  }

  async handleLeaderboardUpdated(em: EntityManager, leaderboard: Leaderboard) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.getSteamConfig().syncLeaderboards) {
          await createSteamworksLeaderboard(em, this, leaderboard) // create if doesn't exist
        }
    }
  }

  async handleLeaderboardDeleted(em: EntityManager, leaderboardInternalName: string) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.getSteamConfig().syncLeaderboards) {
          await deleteSteamworksLeaderboard(em, this, leaderboardInternalName)
        }
    }
  }

  async handleLeaderboardEntryCreated(em: EntityManager, entry: LeaderboardEntry) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (
          entry.playerAlias.service === PlayerAliasService.STEAM &&
          this.getSteamConfig().syncLeaderboards
        ) {
          await createSteamworksLeaderboardEntry(em, this, entry)
        }
    }
  }

  async handleLeaderboardEntryVisibilityToggled(em: EntityManager, entry: LeaderboardEntry) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (
          entry.playerAlias.service === PlayerAliasService.STEAM &&
          this.getSteamConfig().syncLeaderboards
        ) {
          if (entry.hidden || entry.deletedAt) {
            await deleteSteamworksLeaderboardEntry(em, this, entry)
          } else {
            await createSteamworksLeaderboardEntry(em, this, entry)
          }
        }
    }
  }

  async handleLeaderboardEntryArchived(em: EntityManager, entry: LeaderboardEntry) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (
          entry.playerAlias.service === PlayerAliasService.STEAM &&
          this.getSteamConfig().syncLeaderboards
        ) {
          await deleteSteamworksLeaderboardEntry(em, this, entry)
        }
    }
  }

  async handleSyncLeaderboards(em: EntityManager) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        await syncSteamworksLeaderboards(em, this)
    }
  }

  async handleStatUpdated(em: EntityManager, playerStat: PlayerGameStat) {
    await playerStat.player.aliases.loadItems()
    const steamAlias = playerStat.player.aliases
      .getItems()
      .find((alias) => alias.service === PlayerAliasService.STEAM)

    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (steamAlias && this.getSteamConfig().syncStats) {
          await setSteamworksStat(em, this, playerStat, steamAlias)
        }
    }
  }

  async handleSyncStats(em: EntityManager) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        await syncSteamworksStats(em, this)
    }
  }

  async getPlayerIdentifier(
    em: EntityManager,
    identifier: string,
  ): Promise<AuthenticateTicketResult | AuthenticateAuthCodeResult> {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        return authenticateTicket(em, this, identifier)
      case IntegrationType.GOOGLE_PLAY_GAMES:
        return authenticateAuthCode(em, this, identifier)
    }
  }

  // TODO: should be more generic (drop the Steamworks)
  async cleanupSteamworksLeaderboardEntry(
    em: EntityManager,
    steamworksEntry: SteamworksLeaderboardEntry,
  ) {
    await cleanupSteamworksLeaderboardEntry(em, this, steamworksEntry)
  }

  // TODO: should be more generic (drop the Steamworks)
  async cleanupSteamworksPlayerStat(em: EntityManager, steamworksPlayerStat: SteamworksPlayerStat) {
    await cleanupSteamworksPlayerStat(em, this, steamworksPlayerStat)
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      config: this.getConfig(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
