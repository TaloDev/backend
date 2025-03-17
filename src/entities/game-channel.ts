import { Collection, Embedded, Entity, EntityManager, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import PlayerAlias from './player-alias'
import Game from './game'
import Prop from './prop'
import { Request, Required, ValidationCondition } from 'koa-clay'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import { sendMessages, SocketMessageResponse } from '../socket/messages/socketMessage'
import Socket from '../socket'
import { APIKeyScope } from './api-key'

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
  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  async sendMessageToMembers<T extends object>(req: Request, res: SocketMessageResponse, data: T) {
    const socket: Socket = req.ctx.wss
    const conns = socket.findConnections((conn) => {
      return conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) &&
        this.members.getIdentifiers().includes(conn.playerAliasId)
    })
    await sendMessages(conns, res, data)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      owner: this.owner,
      totalMessages: this.totalMessages,
      props: this.props,
      autoCleanup: this.autoCleanup,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  async toJSONWithCount(em: EntityManager, includeDevData: boolean) {
    return {
      ...this.toJSON(),
      memberCount: await this.members.loadCount({
        where: {
          player: includeDevData ? {} : devDataPlayerFilter(em)
        }
      })
    }
  }
}
