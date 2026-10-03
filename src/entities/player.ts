import { ClickHouseClient } from '@clickhouse/client'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/es'
import { Collection, EntityManager } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import createClickHouseClient from '../lib/clickhouse/createClient.js'
import checkGroupMemberships from '../lib/groups/checkGroupMemberships.js'
import Socket from '../socket/index.js'
import { sendMessages } from '../socket/messages/socketMessage.js'
import { APIKeyScope } from './api-key.js'
import Game from './game.js'
import PlayerAlias from './player-alias.js'
import PlayerAuth from './player-auth.js'
import PlayerGroup from './player-group.js'
import PlayerPresence from './player-presence.js'
import PlayerProp from './player-prop.js'
import PlayerSession, { PlayerSessionRef } from './player-session.js'

export const DEV_BUILD_META_KEY = 'META_DEV_BUILD'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @OneToMany(() => PlayerProp, (prop) => prop.player, { orphanRemoval: true, eager: true })
  props: Collection<PlayerProp> = new Collection<PlayerProp>(this)

  @ManyToMany(() => PlayerGroup, (group) => group.members, { eager: true })
  groups = new Collection<PlayerGroup>(this)

  @ManyToOne(() => Game)
  game: Game

  @OneToOne({ nullable: true, orphanRemoval: true })
  auth: PlayerAuth | null = null

  @OneToOne({ nullable: true, orphanRemoval: true, eager: true })
  presence: PlayerPresence | null = null

  @Property()
  devBuild: boolean = false

  @Index()
  @Property()
  lastSeenAt: Date = new Date()

  @Index()
  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  static getSearchCacheKey(game: Game, wildcard = false) {
    let key = `player-search-${game.id}`
    if (wildcard) key += '-*'
    return key
  }

  constructor(game: Game) {
    this.game = game
  }

  addProp(key: string, value: string) {
    this.props.add(new PlayerProp(this, key, value))
  }

  upsertProp(key: string, value: string) {
    const prop = this.props.getItems().find((prop) => prop.key === key)

    if (prop) {
      prop.value = value
    } else {
      this.addProp(key, value)
    }
  }

  removeProp(key: string) {
    const prop = this.props.getItems().find((prop) => prop.key === key)

    if (prop) {
      this.props.remove(prop)
    }
  }

  setProps(props: { key: string; value: string }[]) {
    this.props.set(props.map(({ key, value }) => new PlayerProp(this, key, value)))
  }

  async insertSession(clickhouse: ClickHouseClient, session: PlayerSession) {
    await clickhouse.insert({
      table: 'player_sessions',
      values: session.toInsertable(),
      format: 'JSON',
    })
  }

  async handleSession(online: boolean, session?: PlayerSessionRef) {
    let clickhouse: ClickHouseClient | null = null

    try {
      clickhouse = createClickHouseClient()

      if (online) {
        const newSession = new PlayerSession()
        newSession.construct(this)
        await this.insertSession(clickhouse, newSession)
        return { id: newSession.id, startedAt: newSession.startedAt }
      }

      // no session to close (e.g. the open insert never happened) - not an error
      if (!session) {
        return
      }

      const closedSession = new PlayerSession()
      closedSession.construct(this)
      closedSession.id = session.id
      closedSession.startedAt = session.startedAt
      closedSession.endSession()

      await this.insertSession(clickhouse, closedSession)
    } finally {
      if (clickhouse) {
        await clickhouse.close()
      }
    }
  }

  async setPresence(
    em: EntityManager,
    socket: Socket,
    playerAlias: PlayerAlias,
    online?: boolean,
    customStatus?: string,
  ) {
    if (!this.presence) {
      this.presence = new PlayerPresence(this)
      em.persist(this.presence)
    }

    const updateOnline = typeof online === 'boolean'
    const updateCustomStatus = typeof customStatus === 'string'

    const prevOnline = this.presence.online
    const prevCustomStatus = this.presence.customStatus

    if (updateOnline || updateCustomStatus) {
      this.presence.playerAlias = playerAlias
    }

    if (updateOnline) {
      this.presence.online = online
    }

    if (updateCustomStatus) {
      this.presence.customStatus = customStatus
    }

    if (!this.presence.online) {
      await playerAlias.handleTemporaryChannels(em, socket)
    }

    await em.flush()

    const conns = socket.findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_PRESENCE) &&
        !!conn.playerAliasId &&
        this.game.id === conn.gameId
      )
    })
    sendMessages(conns, 'v1.players.presence.updated', {
      presence: this.presence,
      meta: {
        onlineChanged: prevOnline !== online,
        customStatusChanged: prevCustomStatus !== customStatus,
      },
    })
  }

  markAsDevBuild() {
    this.devBuild = true
    this.upsertProp(DEV_BUILD_META_KEY, '1')
  }

  async checkGroupMemberships(em: EntityManager) {
    await checkGroupMemberships(em, this)
  }

  toJSON() {
    const presence = this.presence ? { ...this.presence.toJSON(), playerAlias: undefined } : null

    return {
      id: this.id,
      props: this.props,
      aliases: this.aliases,
      devBuild: this.devBuild,
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt,
      groups: this.groups.map(({ id, name }) => ({ id, name })),
      auth: this.auth ?? undefined,
      presence,
    }
  }
}
