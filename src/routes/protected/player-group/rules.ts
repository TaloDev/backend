import { protectedRoute } from '../../../lib/routing/router'
import { PlayerRuleFields } from '../../../entities/player-group'
import { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../entities/player-group-rule'

export const rulesRoute = protectedRoute({
  method: 'get',
  path: '/rules',
  handler: async () => {
    let rules = [
      {
        name: PlayerGroupRuleName.EQUALS,
        castTypes: [PlayerGroupRuleCastType.CHAR, PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 1
      },
      {
        name: PlayerGroupRuleName.SET,
        castTypes: [PlayerGroupRuleCastType.CHAR, PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 0
      },
      {
        name: PlayerGroupRuleName.GT,
        negatable: false,
        castTypes: [PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 1
      },
      {
        name: PlayerGroupRuleName.GTE,
        negatable: false,
        castTypes: [PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 1
      },
      {
        name: PlayerGroupRuleName.LT,
        negatable: false,
        castTypes: [PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 1
      },
      {
        name: PlayerGroupRuleName.LTE,
        negatable: false,
        castTypes: [PlayerGroupRuleCastType.DOUBLE, PlayerGroupRuleCastType.DATETIME],
        operandCount: 1
      }
    ]

    rules = [
      ...rules.map((rule) => ({ ...rule, negate: false })),
      // add an inverse copy of each negatable rule
      ...rules.filter((rule) => rule.negatable !== false).map((rule) => ({ ...rule, negate: true }))
    ].sort((a, b) => {
      return a.name.localeCompare(b.name)
    })

    return {
      status: 200,
      body: {
        availableRules: rules,
        availableFields: PlayerRuleFields
      }
    }
  }
})
