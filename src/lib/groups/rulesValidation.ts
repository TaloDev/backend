import { ValidationCondition } from 'koa-clay'
import { PlayerField, PlayerRuleFields, RuleMode } from '../../entities/player-group.js'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../entities/player-group-rule.js'

export const rulesValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Array.isArray(val),
    error: 'Rules must be an array',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Object.values(PlayerGroupRuleName).includes(rule.name)),
    error: 'Invalid rule name(s) provided',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Object.values(PlayerGroupRuleCastType).includes(rule.castType)),
    error: 'Invalid rule type(s) provided',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => [true, false].includes(rule.negate)),
    error: 'Missing rule type(s)',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => {
      const matchesRuleField = PlayerRuleFields
        .map((f) => f.mapsTo)
        .filter((_, idx) => idx > 0) // exclude the props field, checked by regex below
        .includes(rule.field as PlayerField)

      return matchesRuleField || rule.field.match(/props\.(.)*/)
    }),
    error: 'Invalid rule field(s) provided',
    break: true
  },
  {
    check: (val as PlayerGroupRule[]).every?.((rule) => Array.isArray(rule.operands)),
    error: 'Rule operand(s) must be an array',
    break: true
  }
]

export const ruleModeValidation = async (val: unknown): Promise<ValidationCondition[]> => [
  {
    check: Object.values(RuleMode).includes(val as RuleMode),
    error: 'PlayerGroupRule mode must be one of $and, $or'
  }
]
