import { EntityManager, Embeddable, Enum, Property, QBFilterQuery, raw } from '@mikro-orm/mysql'
import Player from './player'
import PlayerProp from './player-prop'

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

export type PlayerGroupRuleField = keyof Player | `props.${string}`

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

  private isPropsNotSetQuery() {
    return this.name === PlayerGroupRuleName.SET && this.negate && this.field.startsWith('props.')
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
    if (this.field.startsWith('props.')) {
      return {
        id: {
          $in: em.qb(PlayerProp).select('player_id', true).where({
            key: this.field.split('props.')[1],
            [this.getCastedKey('value')]: fieldQuery
          }).getKnexQuery()
        }
      }
    } else {
      return {
        [this.field]: fieldQuery
      }
    }
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
            key: this.field.split('props.')[1]
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
      operands: this.operands
    }
  }
}
