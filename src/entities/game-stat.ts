import { EntityManager, Entity, ManyToOne, PrimaryKey, Property, Collection, OneToMany } from '@mikro-orm/core'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import PlayerGameStat from './player-game-stat'

@Entity()
export default class GameStat {
  @PrimaryKey()
  id: number

  @Required({
    methods: ['POST'],
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const em: EntityManager = req.ctx.em
      const duplicateInternalName = await em.getRepository(GameStat).findOne({ internalName: val, game: req.body.gameId })

      return [
        {
          check: !duplicateInternalName,
          error: `A stat with the internalName ${val} already exists`
        }
      ]
    }
  })
  @Property()
  internalName: string

  @Required({ methods: ['POST'] })
  @Property()
  name: string

  @Required({ methods: ['POST'] })
  @Property()
  global: boolean

  @Property({ type: 'double' })
  globalValue: number

  hydratedGlobalValue: number

  @Property({ nullable: true, type: 'double' })
  maxChange: number

  @Required({
    methods: [],
    validation: async (value: number, req: Request): Promise<ValidationCondition[]> => [{
      check: value < (req.body.maxValue ?? Infinity),
      error: 'minValue must be less than maxValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  minValue: number

  @Required({
    methods: [],
    validation: async (value: number, req: Request): Promise<ValidationCondition[]> => [{
      check: value > (req.body.minValue ?? -Infinity),
      error: 'maxValue must be greater than minValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  maxValue: number

  @Required({
    methods: ['POST'],
    validation: async (value: number, req: Request): Promise<ValidationCondition[]> => [{
      check: value >= (req.body.minValue ?? -Infinity) && value <= (req.body.maxValue ?? Infinity),
      error: 'defaultValue must be between minValue and maxValue'
    }]
  })
  @Property({ type: 'double' })
  defaultValue: number

  @Required({ methods: ['POST'] })
  @Property()
  minTimeBetweenUpdates: number

  @Required({
    methods: ['POST'],
    as: 'gameId'
  })
  @ManyToOne(() => Game)
  game: Game

  @OneToMany(() => PlayerGameStat, (playerStat) => playerStat.stat)
  playerStats: Collection<PlayerGameStat> = new Collection<PlayerGameStat>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  async recalculateGlobalValue(includeDevData: boolean): Promise<void> {
    if (includeDevData) return

    this.hydratedGlobalValue = this.globalValue
    const playerStats = await this.playerStats.loadItems()
    this.hydratedGlobalValue -= playerStats.reduce((acc, curr) => acc += curr.value, 0)
  }

  toJSON() {
    return {
      id: this.id,
      internalName: this.internalName,
      name: this.name,
      global: this.global,
      globalValue: this.hydratedGlobalValue ?? this.globalValue,
      defaultValue: this.defaultValue,
      maxChange: this.maxChange,
      minValue: this.minValue,
      maxValue: this.maxValue,
      minTimeBetweenUpdates: this.minTimeBetweenUpdates,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
