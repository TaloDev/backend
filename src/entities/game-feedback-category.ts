import { Entity, EntityManager, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import { Required, ValidationCondition, Request } from 'koa-clay'
import Game from './game'

@Entity()
@Index({ properties: ['game', 'internalName'] })
export default class GameFeedbackCategory {
  @PrimaryKey()
  id!: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateInternalName = await (<EntityManager>req.ctx.em).getRepository(GameFeedbackCategory).findOne({
        id: { $ne: Number(id ?? null) },
        internalName: val as string,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateInternalName,
          error: `A feedback category with the internalName '${val}' already exists`
        }
      ]
    }
  })
  @Property()
  internalName!: string

  @Required()
  @Property()
  name!: string

  @Required()
  @Property()
  description!: string

  @Required()
  @Property()
  anonymised!: boolean

  @ManyToOne(() => Game)
  game: Game

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
      internalName: this.internalName,
      name: this.name,
      description: this.description,
      anonymised: this.anonymised,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
