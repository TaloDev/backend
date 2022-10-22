import { ValidationCondition } from 'koa-clay'
import { PlayerField, PlayerRuleFields, RuleMode } from '../../entities/player-group'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../entities/player-group-rule'

export const rulesValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Array.isArray(val),
    error: 'Rules must be an array',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Object.values(PlayerGroupRuleName).includes(rule.name)),
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Object.values(PlayerGroupRuleCastType).includes(rule.castType)),
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => [true, false].includes(rule.negate)),
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => {
      const matchesRuleField = PlayerRuleFields
        .map((f) => f.mapsTo)
        .filter((_, idx) => idx > 0) // exclude the first field, checked by regex below
        .includes(rule.field as PlayerField)

      return matchesRuleField || rule.field.match(/props\.(.)*/)
    }),
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Array.isArray(rule.operands)),
    break: true
  }
]

export const ruleModeValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Object.values(RuleMode).includes(val as RuleMode),
    error: 'PlayerGroupRule mode must be one of $and, $or'
  }
]
