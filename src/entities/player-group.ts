import { Collection, Embedded, Entity, Enum, ManyToMany, ManyToOne, PrimaryKey, Property, EntityManager, QueryBuilder } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import { Required } from 'koa-clay'
import Game from './game'
import Player from './player'
import PlayerGroupRule, { PlayerGroupRuleCastType } from './player-group-rule'
import { ruleModeValidation, rulesValidation } from '../lib/groups/rulesValidation'

export enum RuleMode {
  AND = '$and',
  OR = '$or'
}

export const propWithKeyNamespace = 'props'
export const statValueNamespace = 'statValue'
export const leaderboardEntryScoreNamespace = 'leaderboardEntryScore'

type RuleFields = {
  fieldDisplayName: string
  defaultCastType: PlayerGroupRuleCastType
  mapsTo: keyof Player | typeof statValueNamespace | typeof leaderboardEntryScoreNamespace
  namespaced: boolean
}

export const PlayerRuleFields: RuleFields[] = [
  {
    fieldDisplayName: 'prop with key',
    defaultCastType: PlayerGroupRuleCastType.CHAR,
    mapsTo: 'props',
    namespaced: true
  },
  {
    fieldDisplayName: 'latest login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'lastSeenAt',
    namespaced: false
  },
  {
    fieldDisplayName: 'first login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'createdAt',
    namespaced: false
  },
  {
    fieldDisplayName: 'value for stat',
    defaultCastType: PlayerGroupRuleCastType.DOUBLE,
    mapsTo: 'statValue',
    namespaced: true
  },
  {
    fieldDisplayName: 'score in leaderboard',
    defaultCastType: PlayerGroupRuleCastType.DOUBLE,
    mapsTo: 'leaderboardEntryScore',
    namespaced: true
  }
]

@Entity()
export default class PlayerGroup {
  @PrimaryKey()
  id: string = v4()

  @Required()
  @Property()
  name!: string

  @Required()
  @Property()
  description!: string

  @Required()
  @Property({ default: false })
  membersVisible!: boolean

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

  private buildCondition(em: EntityManager, query: QueryBuilder<Player>, rule: PlayerGroupRule) {
    query.where(rule.getQuery(em), this.ruleMode)
  }

  getQuery(em: EntityManager) {
    const query = em.qb(Player)
    for (const rule of this.rules) {
      this.buildCondition(em, query, rule)
    }

    return query
      .andWhere({ game: this.game })
      .select('id')
  }

  async checkMembership(em: EntityManager) {
    const players = await this.getQuery(em).getResultList()
    this.members.set(players)
  }

  async isPlayerEligible(em: EntityManager, player: Player): Promise<boolean> {
    /* v8 ignore next */
    const ttl = process.env.NODE_ENV === 'test' ? 0 : 500

    const query = this.getQuery(em).andWhere({
      id: player.id
    }).cache([`group-eligibility-${this.id}-${player.id}`, ttl])

    return await query.count() > 0
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      rules: this.rules,
      ruleMode: this.ruleMode,
      membersVisible: this.membersVisible,
      updatedAt: this.updatedAt
    }
  }

  async toJSONWithCount(em: EntityManager, includeDevData: boolean) {
    return {
      ...this.toJSON(),
      count: await this.members.loadCount({
        where: includeDevData ? {} : { devBuild: false }
      })
    }
  }
}
