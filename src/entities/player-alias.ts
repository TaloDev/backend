import { Collection, Entity, EntityManager, Index, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import Redis from 'ioredis'
import { v4 } from 'uuid'
import GameChannel, { GameChannelLeavingReason } from './game-channel'
import Socket from '../socket'
import { clearResponseCache } from '../lib/perf/responseCache'

export enum PlayerAliasService {
  STEAM = 'steam',
  EPIC = 'epic',
  USERNAME = 'username',
  EMAIL = 'email',
  CUSTOM = 'custom',
  TALO = 'talo'
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

  async createSocketToken(redis: Redis): Promise<string> {
    const token = v4()
    await redis.set(`socketTokens.${this.id}`, token, 'EX', 3600)
    return token
  }

  async handleTemporaryChannels(em: EntityManager, socket: Socket) {
    const temporaryChannels = await em.repo(GameChannel).find({
      members: {
        $some: {
          id: this.id
        }
      },
      temporaryMembership: true
    }, { populate: ['members:ref'] })

    for (const channel of temporaryChannels) {
      channel.members.remove(this)
      void clearResponseCache(GameChannel.getSubscriptionsCacheKey(this.id, true))

      if (channel.shouldAutoCleanup(this)) {
        em.remove(channel)
        await channel.sendDeletedMessage(socket)
      } else {
        await channel.sendMessageToMembers(socket, 'v1.channels.player-left', {
          channel,
          playerAlias: this,
          meta: {
            reason: GameChannelLeavingReason.TEMPORARY_MEMBERSHIP
          }
        })
      }
    }
  }

  toJSON() {
    const player = { ...this.player.toJSON(), aliases: undefined }

    return {
      id: this.id,
      service: this.service,
      identifier: this.identifier,
      player,
      lastSeenAt: this.lastSeenAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
