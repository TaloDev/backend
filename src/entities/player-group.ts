import {
  Collection,
  Embedded,
  Entity,
  Enum,
  ManyToMany,
  ManyToOne,
  PrimaryKey,
  Property,
  EntityManager,
  QueryBuilder,
} from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import Game from './game'
import Player from './player'
import PlayerGroupRule, { PlayerGroupRuleCastType } from './player-group-rule'

export enum RuleMode {
  AND = '$and',
  OR = '$or',
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
    namespaced: true,
  },
  {
    fieldDisplayName: 'latest login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'lastSeenAt',
    namespaced: false,
  },
  {
    fieldDisplayName: 'first login',
    defaultCastType: PlayerGroupRuleCastType.DATETIME,
    mapsTo: 'createdAt',
    namespaced: false,
  },
  {
    fieldDisplayName: 'value for stat',
    defaultCastType: PlayerGroupRuleCastType.DOUBLE,
    mapsTo: 'statValue',
    namespaced: true,
  },
  {
    fieldDisplayName: 'score in leaderboard',
    defaultCastType: PlayerGroupRuleCastType.DOUBLE,
    mapsTo: 'leaderboardEntryScore',
    namespaced: true,
  },
]

@Entity()
export default class PlayerGroup {
  @PrimaryKey()
  id: string = v4()

  @Property()
  name!: string

  @Property()
  description!: string

  @Property({ default: false })
  membersVisible!: boolean

  @Embedded(() => PlayerGroupRule, { array: true })
  rules: PlayerGroupRule[] = []

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

  static getCacheKey(game: Game) {
    return `groups-for-game-${game.id}`
  }

  private buildCondition(em: EntityManager, query: QueryBuilder<Player>, rule: PlayerGroupRule) {
    query.where(rule.getQuery(em), this.ruleMode)
  }

  getQuery(em: EntityManager) {
    const query = em.qb(Player)
    for (const rule of this.rules) {
      this.buildCondition(em, query, rule)
    }

    return query.andWhere({ game: this.game }).select('id')
  }

  async checkMembership(em: EntityManager) {
    const players = await this.getQuery(em).getResultList()
    this.members.set(players)
    await em.flush()
  }

  async isPlayerEligible(em: EntityManager, player: Player): Promise<boolean> {
    const query = this.getQuery(em).andWhere({
      id: player.id,
    })

    return (await query.count()) > 0
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      rules: this.rules,
      ruleMode: this.ruleMode,
      membersVisible: this.membersVisible,
      updatedAt: this.updatedAt,
    }
  }

  async toJSONWithCount(includeDevData: boolean) {
    return {
      ...this.toJSON(),
      count: await this.members.loadCount({
        where: includeDevData ? {} : { devBuild: false },
      }),
    }
  }
}
