import { Collection, Entity, EntityManager, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Game from './game'
import { v4 } from 'uuid'
import PlayerAlias from './player-alias'
import PlayerProp from './player-prop'
import PlayerGroup from './player-group'
import PlayerAuth from './player-auth'
import PlayerPresence from './player-presence'
import Socket from '../socket'
import { sendMessages } from '../socket/messages/socketMessage'
import { APIKeyScope } from './api-key'

@Entity()
export default class Player {
  @PrimaryKey()
  id: string = v4()

  @OneToMany(() => PlayerAlias, (alias) => alias.player)
  aliases: Collection<PlayerAlias> = new Collection<PlayerAlias>(this)

  @OneToMany(() => PlayerProp, (prop) => prop.player, { eager: true, orphanRemoval: true })
  props: Collection<PlayerProp> = new Collection<PlayerProp>(this)

  @ManyToMany(() => PlayerGroup, (group) => group.members, { eager: true })
  groups = new Collection<PlayerGroup>(this)

  @ManyToOne(() => Game)
  game: Game

  @OneToOne({ nullable: true, orphanRemoval: true })
  auth: PlayerAuth

  @OneToOne({ nullable: true, orphanRemoval: true, eager: true })
  presence: PlayerPresence

  @Property()
  lastSeenAt: Date = new Date()

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  isDevBuild() {
    return this.props.getItems().some((prop) => prop.key === 'META_DEV_BUILD')
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

  setProps(props: { key: string, value: string }[]) {
    this.props.set(props.map(({ key, value }) => new PlayerProp(this, key, value)))
  }

  async setPresence(em: EntityManager, socket: Socket, playerAlias: PlayerAlias, online?: boolean, customStatus?: string) {
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

    await em.flush()

    const conns = await socket.findConnectionsAsync(async (conn) => {
      return conn.hasScope(APIKeyScope.READ_PLAYERS) &&
        conn.playerAliasId &&
        this.game.id === (await conn.getPlayerAlias())?.player.game.id
    })
    await sendMessages(conns, 'v1.players.presence.updated', {
      presence: this.presence,
      meta: {
        onlineChanged: prevOnline !== online,
        customStatusChanged: prevCustomStatus !== customStatus
      }
    })
  }

  toJSON() {
    const presence = this.presence ? { ...this.presence.toJSON(), playerAlias: undefined } : null

    return {
      id: this.id,
      props: this.props.getItems().map(({ key, value }) => ({ key, value })),
      aliases: this.aliases,
      devBuild: this.isDevBuild(),
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt,
      groups: this.groups.getItems().map((group) => ({ id: group.id, name: group.name })),
      auth: this.auth ?? undefined,
      presence
    }
  }
}
