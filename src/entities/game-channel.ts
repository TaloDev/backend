import { Collection, Embedded, Entity, EntityManager, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import PlayerAlias from './player-alias'
import Game from './game'
import Prop from './prop'
import { Required, ValidationCondition } from 'koa-clay'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import { Request } from 'koa-clay'

@Entity()
export default class GameChannel {
  @PrimaryKey()
  id: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const duplicateName = await (<EntityManager>req.ctx.em).getRepository(GameChannel).findOne({
        name: val,
        game: req.ctx.state.game
      })

      return [
        {
          check: !duplicateName,
          error: `A channel with the name '${val}' already exists`
        }
      ]
    }
  })
  @Property()
  name: string

  @ManyToOne(() => PlayerAlias, { nullable: true, eager: true })
  owner: PlayerAlias

  @ManyToMany(() => PlayerAlias, (alias) => alias.channels, { owner: true })
  members = new Collection<PlayerAlias>(this)

  @Property()
  totalMessages: number = 0

  @Required()
  @Property()
  autoCleanup: boolean = false

  @ManyToOne(() => Game)
  game: Game

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      owner: this.owner,
      totalMessages: this.totalMessages,
      props: this.props,
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
