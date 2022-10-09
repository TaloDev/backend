import { Collection, Embedded, Entity, Enum, ManyToMany, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import { EntityManager, QueryBuilder } from '@mikro-orm/mysql'
import { Request, Required, ValidationCondition } from 'koa-clay'
import Game from './game'
import Player from './player'
import PlayerGroupRule from './player-group-rule'
import { ruleModeValidation, rulesValidation } from '../lib/groups/rulesValidation'

export enum RuleMode {
  AND = '$and',
  OR = '$or'
}

export type PlayerField = keyof Player | 'prop with key'

type RuleFields = {
  field: PlayerField
}

export const PlayerRuleFields: RuleFields[] = [
  {
    field: 'prop with key'
  },
  {
    field: 'lastSeenAt'
  },
  {
    field: 'createdAt'
  }
]

@Entity()
export default class PlayerGroup {
  @PrimaryKey()
  id: number

  @Required({
    validation: async (val: unknown, req: Request): Promise<ValidationCondition[]> => {
      const { gameId, id } = req.params
      const duplicateName = await (<EntityManager>req.ctx.em).getRepository(PlayerGroup).findOne({
        id: { $ne: Number(id ?? null) },
        name: val,
        game: Number(gameId)
      })

      return [
        {
          check: !duplicateName,
          error: `A group with the name ${val} already exists`
        }
      ]
    }
  })
  @Property()
  name: string

  @Required()
  @Property()
  description: string

  @Required({
    validation: rulesValidation
  })
  @Embedded(() => PlayerGroupRule, { array: true })
  rules: PlayerGroupRule[] = []

  @Required({
    validation: ruleModeValidation
  })
  @Enum(() => RuleMode)
  ruleMode: RuleMode = RuleMode.AND

  @ManyToOne(() => Game)
  game: Game

  @ManyToMany(() => Player, (player) => player.groups, { owner: true })
  members = new Collection<Player>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  private buildCondition(em: EntityManager, query: QueryBuilder<Player>, rule: PlayerGroupRule): QueryBuilder<Player> {
    return query.where(rule.getQuery(em, query), this.ruleMode)
  }

  getQuery(em: EntityManager) {
    let query = em.qb(Player)
    for (const rule of this.rules) {
      query = this.buildCondition(em, query, rule)
    }

    return query.andWhere({
      game: this.game
    })
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      rules: this.rules,
      ruleMode: this.ruleMode,
      updatedAt: this.updatedAt
    }
  }
}
