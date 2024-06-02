import { Collection, Embedded, Entity, Enum, ManyToMany, ManyToOne, PrimaryKey, Property, EntityManager, QueryBuilder, Rel } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import { Required } from 'koa-clay'
import Game from './game.js'
import Player from './player.js'
import PlayerGroupRule, { PlayerGroupRuleCastType } from './player-group-rule.js'
import { ruleModeValidation, rulesValidation } from '../lib/groups/rulesValidation.js'

export enum RuleMode {
  AND = '$and',
  OR = '$or'
}

export type PlayerField = keyof Player | 'prop with key'

type RuleFields = {
  field: string
  defaultCastType?: PlayerGroupRuleCastType
  mapsTo: PlayerField
}

export const PlayerRuleFields: RuleFields[] = [
  {
    field: 'prop with key',
    defaultCastType: PlayerGroupRuleCastType.CHAR,
    mapsTo: 'props'
  },
  {
    field: 'latest login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'lastSeenAt'
  },
  {
    field: 'first login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'createdAt'
  }
]

@Entity()
export default class PlayerGroup {
  @PrimaryKey()
  id: string = v4()

  @Required()
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
  game: Rel<Game>

  @ManyToMany(() => Player, (player) => player.groups, { owner: true })
  members = new Collection<Player>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Rel<Game>) {
    this.game = game
  }

  private buildCondition(em: EntityManager, query: QueryBuilder<Player>, rule: PlayerGroupRule): QueryBuilder<Player> {
    return query.where(rule.getQuery(em), this.ruleMode)
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

  async checkMembership(em: EntityManager) {
    const players = await this.getQuery(em).getResultList()
    this.members.set(players)
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
