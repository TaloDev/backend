import { EntityManager, Entity, ManyToOne, PrimaryKey, Property, Collection, OneToMany } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import PlayerGameStat from './player-game-stat'

@Entity()
export default class GameStat {
  @PrimaryKey()
  id!: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateInternalName = await (<EntityManager>req.ctx.em).getRepository(GameStat).findOne({
        id: { $ne: Number(id ?? null) },
        internalName: val as string,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateInternalName,
          error: `A stat with the internalName '${val}' already exists`
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
  global!: boolean

  @Property({ type: 'double' })
  globalValue!: number

  hydratedGlobalValue!: number

  @Required({
    validation: async (value: unknown): Promise<ValidationCondition[]> => [{
      check: value !== null ? (value as number) > 0 : true,
      error: 'maxChange must be greater than 0'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  maxChange: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: req.body.maxValue ? (value as number) < (req.body.maxValue as number) : true,
      error: 'minValue must be less than maxValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  minValue: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: req.body.minValue ? (value as number) > (req.body.minValue as number) : true,
      error: 'maxValue must be greater than minValue'
    }]
  })
  @Property({ nullable: true, type: 'double' })
  maxValue: number | null = null

  @Required({
    validation: async (value: unknown, req: Request): Promise<ValidationCondition[]> => [{
      check: value !== null && (value as number) >= (req.body.minValue ?? -Infinity) && (value as number) <= (req.body.maxValue ?? Infinity),
      error: 'defaultValue must be between minValue and maxValue'
    }]
  })
  @Property({ type: 'double' })
  defaultValue!: number

  @Required()
  @Property()
  minTimeBetweenUpdates!: number

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
    this.hydratedGlobalValue = this.globalValue

    if (includeDevData) return

    const playerStats = await this.playerStats.loadItems({ populate: ['player'] })

    this.hydratedGlobalValue -= playerStats
      .filter((playerStat) => playerStat.player.isDevBuild())
      .reduce((acc, curr) => acc += curr.value, 0)
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
