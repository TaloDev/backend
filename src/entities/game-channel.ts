import {
  Collection,
  Entity,
  EntityManager,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/mysql'
import Socket from '../socket'
import { sendMessages, SocketMessageResponse } from '../socket/messages/socketMessage'
import { APIKeyScope } from './api-key'
import Game from './game'
import GameChannelProp from './game-channel-prop'
import GameChannelStorageProp from './game-channel-storage-prop'
import PlayerAlias from './player-alias'

export enum GameChannelLeavingReason {
  DEFAULT,
  TEMPORARY_MEMBERSHIP,
}

@Entity()
export default class GameChannel {
  @PrimaryKey()
  id!: number

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

  @ManyToOne(() => Game, { eager: true })
  game: Game

  @OneToMany(() => GameChannelProp, (prop) => prop.gameChannel, {
    eager: true,
    orphanRemoval: true,
  })
  props: Collection<GameChannelProp> = new Collection<GameChannelProp>(this)

  @OneToMany(() => GameChannelStorageProp, (prop) => prop.gameChannel, { orphanRemoval: true })
  storageProps: Collection<GameChannelStorageProp> = new Collection<GameChannelStorageProp>(this)

  @Property()
  temporaryMembership: boolean = false

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static getSearchCacheKey(game: Game, wildcard = false) {
    let key = `channels-search-${game.id}`
    if (wildcard) key += '-*'
    return key
  }

  constructor(game: Game) {
    this.game = game
  }

  async sendMessageToMembers<T extends object>(
    socket: Socket,
    res: SocketMessageResponse,
    data: T,
  ) {
    const conns = socket.findConnections((conn) => {
      return conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) && this.hasMember(conn.playerAliasId)
    })
    await sendMessages(conns, res, data)
  }

  setProps(props: { key: string; value: string }[]) {
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
      updatedAt: this.updatedAt,
    }
  }

  // this is not ideal, but it builds a much more efficient query than mikro-orm
  static async getManyCounts({
    em,
    channelIds,
    includeDevData,
  }: {
    em: EntityManager
    channelIds: number[]
    includeDevData: boolean
  }) {
    const countsMap = new Map(channelIds.map((id) => [id, 0]))
    if (channelIds.length === 0) {
      return countsMap
    }

    const results = await em.getConnection().execute<{ game_channel_id: number; count: number }[]>(
      `
      select gcm.game_channel_id, count(*) as count
      from game_channel_members as gcm
      straight_join player_alias as pa on pa.id = gcm.player_alias_id
      straight_join player as p0 on p0.id = pa.player_id
      where gcm.game_channel_id in (?)
        ${includeDevData ? '' : 'and p0.dev_build = 0'}
      group by gcm.game_channel_id
    `,
      [channelIds],
    )

    for (const r of results) {
      countsMap.set(r.game_channel_id, r.count)
    }
    return countsMap
  }

  toJSONWithCount(countsMap: Map<number, number>) {
    return {
      ...this.toJSON(),
      memberCount: countsMap.get(this.id),
    }
  }
}
