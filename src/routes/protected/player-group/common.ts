import { Next } from 'koa'
import { RefinementCtx, z as zodLib } from 'zod'
import PlayerGroup, { PlayerRuleFields, RuleMode } from '../../../entities/player-group'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../entities/player-group-rule'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type Z = typeof zodLib

type PlayerGroupRouteContext = ProtectedRouteContext<
  GameRouteState & { group: PlayerGroup }
>

export async function loadGroup(ctx: PlayerGroupRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const group = await em.repo(PlayerGroup).findOne({
    id,
    game: ctx.state.game
  })

  if (!group) {
    return ctx.throw(404, 'Group not found')
  }

  ctx.state.group = group
  await next()
}

type RuleInput = {
  name: PlayerGroupRuleName
  field: string
  operands: string[]
  negate: boolean
  castType: PlayerGroupRuleCastType
}

function validateRules(rules: RuleInput[], ctx: RefinementCtx) {
  const validFields = rules.every((rule) => {
    return PlayerRuleFields.some(({ mapsTo, namespaced }) => {
      if (namespaced) {
        // matches "props.keyName", "statValue.statName", etc
        // requires at least one char after the dot
        return new RegExp('^' + mapsTo + '\\..+$').test(rule.field)
      } else {
        return mapsTo === rule.field
      }
    })
  })

  if (!validFields) {
    ctx.addIssue({ code: 'custom', message: 'Invalid rule field(s) provided', path: ['rules'] })
  }
}

const ruleSchema = (z: Z) => z.object({
  name: z.enum(PlayerGroupRuleName),
  field: z.string(),
  operands: z.array(z.string()),
  negate: z.boolean(),
  castType: z.enum(PlayerGroupRuleCastType)
})

const rulesAndModeFields = (z: Z) => ({
  ruleMode: z.enum(RuleMode),
  rules: z.array(ruleSchema(z))
})

export function rulesAndModeSchema(z: Z) {
  return z.object(rulesAndModeFields(z)).superRefine((data, ctx) => {
    validateRules(data.rules, ctx)
  })
}

export function groupBodySchema(z: Z) {
  return z.object({
    ...rulesAndModeFields(z),
    name: z.string(),
    description: z.string(),
    membersVisible: z.boolean()
  }).superRefine((data, ctx) => {
    validateRules(data.rules, ctx)
  })
}

export function buildRulesFromData(data: RuleInput[]) {
  return data.map((d) => {
    const rule = new PlayerGroupRule(d.name, d.field as PlayerGroupRule['field'])
    rule.negate = d.negate
    rule.castType = d.castType
    rule.operands = d.operands
    return rule
  })
}
