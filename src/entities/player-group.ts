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

  // this is not ideal, but it builds a much more efficient query than mikro-orm
  static async getManyCounts({
    em,
    groupIds,
    includeDevData,
  }: {
    em: EntityManager
    groupIds: string[]
    includeDevData: boolean
  }) {
    const countsMap = new Map(groupIds.map((id) => [id, 0]))
    if (groupIds.length === 0) {
      return countsMap
    }

    const results = await em.getConnection().execute<{ player_group_id: string; count: number }[]>(
      `
      select p1.player_group_id, count(*) as count
      from player_group_members as p1
      straight_join player as p0 on p0.id = p1.player_id
      where p1.player_group_id in (?)
        ${includeDevData ? '' : 'and p0.dev_build = 0'}
      group by p1.player_group_id
    `,
      [groupIds],
    )

    for (const r of results) {
      countsMap.set(r.player_group_id, r.count)
    }

    return countsMap
  }

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

  toJSONWithCount(countsMap: Map<string, number>) {
    return {
      ...this.toJSON(),
      count: countsMap.get(this.id),
    }
  }
}
