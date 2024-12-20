import { EntityManager, Embeddable, Enum, Property, QBFilterQuery, raw, QueryBuilder } from '@mikro-orm/mysql'
import Player from './player'
import PlayerProp from './player-prop'
import PlayerGameStat from './player-game-stat'
import LeaderboardEntry from './leaderboard-entry'
import { leaderboardEntryScoreNamespace, propWithKeyNamespace, statValueNamespace } from './player-group'

export enum PlayerGroupRuleName {
  EQUALS = 'EQUALS',
  SET = 'SET',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE'
}

export enum PlayerGroupRuleCastType {
  CHAR = 'CHAR',
  DOUBLE = 'DOUBLE',
  DATETIME = 'DATETIME'
}

type RuleNamespace = typeof propWithKeyNamespace | typeof statValueNamespace | typeof leaderboardEntryScoreNamespace

export type PlayerGroupRuleField = keyof Player
  | `${typeof propWithKeyNamespace}.${string}`
  | `${typeof statValueNamespace}.${string}`
  | `${typeof leaderboardEntryScoreNamespace}.${string}`

@Embeddable()
export default class PlayerGroupRule {
  @Enum(() => PlayerGroupRuleName)
  name: PlayerGroupRuleName

  @Property()
  negate: boolean

  @Property()
  field: PlayerGroupRuleField

  @Enum(() => PlayerGroupRuleCastType)
  castType: PlayerGroupRuleCastType

  @Property()
  operands: string[] = []

  constructor(name: PlayerGroupRuleName, field: PlayerGroupRuleField) {
    this.name = name
    this.field = field
  }

  private fieldMatchesNamespace(namespace: RuleNamespace): boolean {
    return this.field.startsWith(`${namespace}.`)
  }

  private getNamespacedValue(namespace: RuleNamespace): string {
    return this.field.split(`${namespace}.`)[1]
  }

  private isPropsNotSetQuery() {
    return this.name === PlayerGroupRuleName.SET && this.negate && this.fieldMatchesNamespace('props')
  }

  getQuery(em: EntityManager): QBFilterQuery<Player> {
    let query: QBFilterQuery<Player>

    switch (this.name) {
      case PlayerGroupRuleName.EQUALS:
        query = this.getEqualsQuery(em)
        break
      case PlayerGroupRuleName.SET:
        query = this.getSetQuery(em)
        break
      case PlayerGroupRuleName.GT:
        query = this.getGreaterThanQuery(em)
        break
      case PlayerGroupRuleName.GTE:
        query = this.getGreaterThanEqualQuery(em)
        break
      case PlayerGroupRuleName.LT:
        query = this.getLessThanQuery(em)
        break
      case PlayerGroupRuleName.LTE:
        query = this.getLessThanEqualQuery(em)
        break
    }

    if (this.negate && !this.isPropsNotSetQuery()) {
      return {
        $not: query
      }
    }

    return query
  }

  private getCastedKey(key: string): string {
    return raw((alias) => `cast(${alias}.${key} as ${this.castType})`)
  }

  private getOperand(idx: number): string {
    return raw(`cast('${this.operands[idx]}' as ${this.castType})`)
  }

  private buildQuery(em: EntityManager, fieldQuery: QBFilterQuery<Player>): QBFilterQuery<Player> {
    if (this.fieldMatchesNamespace('props')) {
      return {
        id: {
          $in: this.getPropsQuery(em, fieldQuery).getKnexQuery()
        }
      }
    } else if (this.fieldMatchesNamespace('statValue')) {
      return {
        id: {
          $in: this.getStatsQuery(em, fieldQuery).getKnexQuery()
        }
      }
    } else if (this.fieldMatchesNamespace('leaderboardEntryScore')) {
      return {
        id: {
          $in: this.getLeaderboardEntriesQuery(em, fieldQuery).getKnexQuery()
        }
      }
    } else {
      return {
        [this.field]: fieldQuery
      }
    }
  }

  private getPropsQuery(em: EntityManager, fieldQuery: QBFilterQuery<Player>): QueryBuilder<PlayerProp> {
    return em.qb(PlayerProp).select('player_id').where({
      key: this.getNamespacedValue('props'),
      [this.getCastedKey('value')]: fieldQuery
    })
  }

  private getStatsQuery(em: EntityManager, fieldQuery: QBFilterQuery<Player>): QueryBuilder<PlayerGameStat> {
    return em.qb(PlayerGameStat).select('player_id').where({
      stat: {
        internalName: this.getNamespacedValue('statValue')
      },
      [this.getCastedKey('value')]: fieldQuery
    })
  }

  private getLeaderboardEntriesQuery(em: EntityManager, fieldQuery: QBFilterQuery<Player>): QueryBuilder<LeaderboardEntry> {
    return em.qb(LeaderboardEntry)
      .join('playerAlias', 'pa')
      .select('pa.player_id')
      .where({
        leaderboard: {
          internalName: this.getNamespacedValue('leaderboardEntryScore')
        },
        hidden: false,
        [this.getCastedKey('score')]: fieldQuery
      })
  }

  private getEqualsQuery(em: EntityManager): QBFilterQuery<Player> {
    return this.buildQuery(em, {
      $eq: this.getOperand(0)
    })
  }

  private getSetQuery(em: EntityManager): QBFilterQuery<Player> {
    if (this.isPropsNotSetQuery()) {
      return {
        id: {
          $nin: em.qb(PlayerProp).select('player_id', true).where({
            key: this.getNamespacedValue('props')
          }).getKnexQuery()
        }
      }
    }

    return this.buildQuery(em, {
      $ne: null
    })
  }

  private getGreaterThanQuery(em: EntityManager): QBFilterQuery<Player> {
    return this.buildQuery(em, {
      $gt: this.getOperand(0)
    })
  }

  private getGreaterThanEqualQuery(em: EntityManager): QBFilterQuery<Player> {
    return this.buildQuery(em, {
      $gte: this.getOperand(0)
    })
  }

  private getLessThanQuery(em: EntityManager): QBFilterQuery<Player> {
    return this.buildQuery(em, {
      $lt: this.getOperand(0)
    })
  }

  private getLessThanEqualQuery(em: EntityManager): QBFilterQuery<Player> {
    return this.buildQuery(em, {
      $lte: this.getOperand(0)
    })
  }

  toJSON() {
    return {
      name: this.name,
      negate: this.negate,
      field: this.field,
      castType: this.castType,
      operands: this.operands,
      namespaced: this.field.includes('.')
    }
  }
}
