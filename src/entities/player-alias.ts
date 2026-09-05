import type { Redis } from 'ioredis'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/es'
import { Collection, EntityManager } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import Socket from '../socket/index.js'
import GameChannel, { GameChannelLeavingReason } from './game-channel.js'
import Game from './game.js'
import Integration, { IntegrationType } from './integration.js'
import Player from './player.js'

export enum PlayerAliasService {
  STEAM = 'steam',
  EPIC = 'epic',
  USERNAME = 'username',
  EMAIL = 'email',
  CUSTOM = 'custom',
  TALO = 'talo',
  GOOGLE_PLAY_GAMES = 'google_play_games',
  GAME_CENTER = 'game_center',
}

const serviceIdentifierIndexName = 'idx_player_alias_service_identifier'
const serviceIdentifierIndexExpr = `alter table \`player_alias\` add index \`${serviceIdentifierIndexName}\`(\`service\`(191), \`identifier\`(191))`

@Entity()
@Index({ name: serviceIdentifierIndexName, expression: serviceIdentifierIndexExpr })
export default class PlayerAlias {
  @PrimaryKey()
  id!: number

  @Property()
  service!: string

  @Property({ length: 1024 })
  identifier!: string

  @ManyToOne(() => Player, { eager: true, deleteRule: 'cascade' })
  player!: Player

  @Property()
  lastSeenAt: Date = new Date()

  @ManyToMany(() => GameChannel, (channel) => channel.members)
  channels = new Collection<GameChannel>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static async resolveIdentifier({
    em,
    game,
    service,
    identifier,
  }: {
    em: EntityManager
    game: Game
    service: string
    identifier: string
  }) {
    const trimmedService = service.trim()
    const trimmedIdentifier = identifier.trim()

    const type = {
      [PlayerAliasService.STEAM]: IntegrationType.STEAMWORKS,
      [PlayerAliasService.GOOGLE_PLAY_GAMES]: IntegrationType.GOOGLE_PLAY_GAMES,
      [PlayerAliasService.GAME_CENTER]: IntegrationType.GAME_CENTER,
    }[trimmedService]

    if (!type) {
      return { identifier: trimmedIdentifier }
    }

    return PlayerAlias.resolveWithIntegrations({
      em,
      game,
      type,
      identifier: trimmedIdentifier,
    })
  }

  // try every integration for the service until one accepts the credentials
  private static async resolveWithIntegrations({
    em,
    game,
    type,
    identifier,
  }: {
    em: EntityManager
    game: Game
    type: IntegrationType
    identifier: string
  }) {
    // newest integrations first - their credentials are the most likely to be current
    const integrations = await em
      .repo(Integration)
      .find({ game, type }, { orderBy: { createdAt: 'desc' } })

    if (integrations.length === 0) {
      return { identifier }
    }

    let lastError: unknown
    for (const integration of integrations) {
      try {
        return await integration.getPlayerIdentifier(em, identifier)
      } catch (err) {
        lastError = err
      }
    }

    throw lastError
  }

  static getSocketDataKey(id: number) {
    return `socketConnection:alias:${id}`
  }

  async createSocketToken(redis: Redis) {
    const token = v4()
    await redis.set(`socketTokens.${this.id}`, token, 'EX', 3600)
    return token
  }

  async handleTemporaryChannels(em: EntityManager, socket: Socket) {
    const temporaryChannels = await em.repo(GameChannel).find(
      {
        members: {
          $some: {
            id: this.id,
          },
        },
        temporaryMembership: true,
      },
      { populate: ['members:ref'] },
    )

    for (const channel of temporaryChannels) {
      const deleted = await channel.removeMember({
        socket,
        playerAlias: this,
        reason: GameChannelLeavingReason.TEMPORARY_MEMBERSHIP,
      })

      if (deleted) {
        em.remove(channel)
      }
    }
  }

  getDisplayName() {
    const propKey = this.player.game.displayNamePropKey
    if (propKey) {
      const prop = this.player.props.getItems().find((p) => p.key === propKey)
      if (prop) {
        return prop.value
      }
    }
    return this.identifier
  }

  toJSON() {
    return {
      id: this.id,
      service: this.service,
      identifier: this.identifier,
      displayName: this.getDisplayName(),
      player: { ...this.player.toJSON(), aliases: undefined },
      lastSeenAt: this.lastSeenAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
