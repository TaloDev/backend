import { Entity, EntityManager, Enum, Filter, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import { decrypt, encrypt } from '../lib/crypto/string-encryption'
import Game from './game'
import { createSteamworksLeaderboard, createSteamworksLeaderboardEntry, deleteSteamworksLeaderboard, deleteSteamworksLeaderboardEntry, setSteamworksStat, syncSteamworksLeaderboards, syncSteamworksStats } from '../lib/integrations/steamworks-integration'
import Leaderboard from './leaderboard'
import pick from 'lodash.pick'
import LeaderboardEntry from './leaderboard-entry'
import { PlayerAliasService } from './player-alias'
import PlayerGameStat from './player-game-stat'

export enum IntegrationType {
  STEAMWORKS = 'steamworks'
}

export type SteamIntegrationConfig = {
  apiKey: string
  appId: number
  syncLeaderboards: boolean
  syncStats: boolean
}

export type IntegrationConfig = SteamIntegrationConfig

@Entity()
@Filter({ name: 'active', cond: { deletedAt: null }, default: true })
export default class Integration {
  @PrimaryKey()
  id: number

  @Required({
    methods: ['POST'],
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const keys = Object.keys(IntegrationType).map((key) => IntegrationType[key])

      const { gameId, id } = req.params
      const duplicateIntegrationType = await (<EntityManager>req.ctx.em).getRepository(Integration).findOne({
        id: { $ne: Number(id ?? null) },
        type: val,
        game: Number(gameId)
      })

      return [
        {
          check: keys.includes(val),
          error: `Integration type must be one of ${keys.join(', ')}`
        },
        {
          check: !duplicateIntegrationType,
          error: `This game already has an integration for ${val}`
        }
      ]
    }
  })
  @Enum(() => IntegrationType)
  type: IntegrationType

  @ManyToOne(() => Game)
  game: Game

  @Required({ methods: ['POST', 'PATCH'] })
  @Property({ type: 'json' })
  private config: IntegrationConfig

  @Property({ nullable: true })
  deletedAt: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(type: IntegrationType, game: Game, config: IntegrationConfig) {
    this.type = type
    this.game = game

    this.config = {
      ...config,
      apiKey: encrypt(config.apiKey, process.env.STEAM_INTEGRATION_SECRET)
    }
  }

  updateConfig(config: Partial<IntegrationConfig>) {
    if (config.apiKey) config.apiKey = encrypt(config.apiKey, process.env.STEAM_INTEGRATION_SECRET)

    this.config = {
      ...this.config,
      ...config
    }
  }

  getConfig(): IntegrationConfig {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        return pick(this.config, ['appId', 'syncLeaderboards', 'syncStats'])
    }
  }

  getSteamAPIKey(): string {
    return decrypt(this.config.apiKey, process.env.STEAM_INTEGRATION_SECRET)
  }

  async handleLeaderboardCreated(em: EntityManager, leaderboard: Leaderboard) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.config.syncLeaderboards) {
          await createSteamworksLeaderboard(em, this, leaderboard)
        }
    }
  }

  async handleLeaderboardUpdated(em: EntityManager, leaderboard: Leaderboard) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.config.syncLeaderboards) {
          await createSteamworksLeaderboard(em, this, leaderboard) // create if doesn't exist
        }
    }
  }

  async handleLeaderboardDeleted(em: EntityManager, leaderboardInternalName: string) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (this.config.syncLeaderboards) {
          await deleteSteamworksLeaderboard(em, this, leaderboardInternalName)
        }
    }
  }

  async handleLeaderboardEntryCreated(em: EntityManager, entry: LeaderboardEntry) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (entry.playerAlias.service === PlayerAliasService.STEAM && this.config.syncLeaderboards) {
          await createSteamworksLeaderboardEntry(em, this, entry)
        }
    }
  }

  async handleLeaderboardEntryVisibilityToggled(em: EntityManager, entry: LeaderboardEntry) {
    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (entry.playerAlias.service === PlayerAliasService.STEAM && this.config.syncLeaderboards) {
          if (entry.hidden) {
            await deleteSteamworksLeaderboardEntry(em, this, entry)
          } else {
            await createSteamworksLeaderboardEntry(em, this, entry)
          }
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
    const steamAlias = playerStat.player.aliases.getItems().find((alias) => alias.service === PlayerAliasService.STEAM)

    switch (this.type) {
      case IntegrationType.STEAMWORKS:
        if (steamAlias && this.config.syncStats) {
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

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      config: this.getConfig(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
