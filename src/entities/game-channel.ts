import { Collection, Entity, ManyToMany, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import PlayerAlias from './player-alias'
import Game from './game'
import { Required, ValidationCondition } from 'koa-clay'
import { sendMessages, SocketMessageResponse } from '../socket/messages/socketMessage'
import Socket from '../socket'
import { APIKeyScope } from './api-key'
import GameChannelProp from './game-channel-prop'
import GameChannelStorageProp from './game-channel-storage-prop'

export enum GameChannelLeavingReason {
  DEFAULT,
  TEMPORARY_MEMBERSHIP
}

@Entity()
export default class GameChannel {
  @PrimaryKey()
  id!: number

  @Required({
    methods: ['POST']
  })
  @Property()
  name!: string

  @ManyToOne(() => PlayerAlias, { nullable: true, eager: true })
  owner: PlayerAlias | null = null

  @ManyToMany(() => PlayerAlias, (alias) => alias.channels, { owner: true })
  members = new Collection<PlayerAlias>(this)

  @Property()
  totalMessages: number = 0

  @Property()
  autoCleanup: boolean = false

  @Property()
  private: boolean = false

  @ManyToOne(() => Game)
  game: Game

  @Required({
    methods: [],
    validation: async (val: unknown): Promise<ValidationCondition[]> => [
      {
        check: Array.isArray(val),
        error: 'Props must be an array'
      }
    ]
  })
  @OneToMany(() => GameChannelProp, (prop) => prop.gameChannel, { eager: true, orphanRemoval: true })
  props: Collection<GameChannelProp> = new Collection<GameChannelProp>(this)

  @OneToMany(() => GameChannelStorageProp, (prop) => prop.gameChannel, { orphanRemoval: true })
  storageProps: Collection<GameChannelStorageProp> = new Collection<GameChannelStorageProp>(this)

  @Property()
  temporaryMembership: boolean = false

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static getSearchCacheKey(wildcard = false) {
    let key = 'channels-search'
    if (wildcard) key += '*'
    return key
  }

  static getSubscriptionsCacheKey(aliasId: number, wildcard = false) {
    let key = `alias-subscriptions-${aliasId}`
    if (wildcard) key += '*'
    return key
  }

  constructor(game: Game) {
    this.game = game
  }

  async sendMessageToMembers<T extends object>(socket: Socket, res: SocketMessageResponse, data: T) {
    const conns = socket.findConnections((conn) => {
      return conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) && this.hasMember(conn.playerAliasId)
    })
    await sendMessages(conns, res, data)
  }

  setProps(props: { key: string, value: string }[]) {
    this.props.set(props.map(({ key, value }) => new GameChannelProp(this, key, value)))
  }

  shouldAutoCleanup(aliasToRemove: PlayerAlias) {
    return this.autoCleanup && (this.owner?.id === aliasToRemove.id || this.members.count() <= 1)
  }

  hasMember(aliasId: number) {
    return this.members.getIdentifiers().includes(aliasId)
  }

  async sendDeletedMessage(socket: Socket) {
    await this.sendMessageToMembers(socket, 'v1.channels.deleted', { channel: this })
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      owner: this.owner,
      totalMessages: this.totalMessages,
      props: this.props,
      autoCleanup: this.autoCleanup,
      private: this.private,
      temporaryMembership: this.temporaryMembership,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  async toJSONWithCount(includeDevData: boolean) {
    return {
      ...this.toJSON(),
      memberCount: await this.members.loadCount({
        where: {
          player: includeDevData ? {} : { devBuild: false }
        }
      })
    }
  }
}
