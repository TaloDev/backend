import { ValidationCondition } from 'koa-clay'
import { PlayerRuleFields, RuleMode } from '../../entities/player-group'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../entities/player-group-rule'

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
      return PlayerRuleFields
        .some(({ mapsTo, namespaced }) => {
          if (namespaced) {
            return new RegExp('^' + mapsTo + '\\.(.)*$').test(rule.field)
          } else {
            return mapsTo === rule.field
          }
        })
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
