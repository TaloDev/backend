import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Routes } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import PlayerGroup, { PlayerRuleFields, RuleMode } from '../entities/player-group'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../entities/player-group-rule'
import { ruleModeValidation, rulesValidation } from '../lib/groups/rulesValidation'
import createGameActivity from '../lib/logging/createGameActivity'
import PlayerGroupPolicy from '../policies/player-group.policy'

type PlayerGroupWithCount = Pick<PlayerGroup, 'id' | 'name' | 'description' | 'rules' | 'ruleMode' | 'updatedAt'> & { count: number }

@Routes([
  {
    method: 'GET'
  },
  {
    method: 'POST'
  },
  {
    method: 'PUT'
  },
  {
    method: 'DELETE'
  },
  {
    method: 'GET',
    path: '/rules',
    handler: 'rules'
  },
  {
    method: 'GET',
    path: '/preview-count',
    handler: 'previewCount'
  }
])
export default class PlayerGroupService extends Service {
  private async groupWithCount(group: PlayerGroup): Promise<PlayerGroupWithCount> {
    return {
      ...group.toJSON(),
      count: await group.members.loadCount()
    }
  }

  @HasPermission(PlayerGroupPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const groups = await em.getRepository(PlayerGroup).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        groups: await Promise.all(groups.map(this.groupWithCount))
      }
    }
  }

  private buildRulesFromData(data: PlayerGroupRule[]) {
    return data.map((d: PlayerGroupRule) => {
      const rule = new PlayerGroupRule(d.name, d.field)
      rule.negate = d.negate
      rule.castType = d.castType
      rule.operands = d.operands
      return rule
    })
  }

  @Validate({ body: [PlayerGroup] })
  @HasPermission(PlayerGroupPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, description, ruleMode, rules } = req.body
    const em: EntityManager = req.ctx.em

    const group = new PlayerGroup(req.ctx.state.game)
    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = this.buildRulesFromData(rules)
    await group.checkMembership(em)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_CREATED,
      extra: {
        groupName: group.name
      }
    })

    await em.persistAndFlush(group)

    return {
      status: 200,
      body: {
        group: await this.groupWithCount(group)
      }
    }
  }

  @Validate({ body: [PlayerGroup] })
  @HasPermission(PlayerGroupPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const { name, description, ruleMode, rules } = req.body
    const em: EntityManager = req.ctx.em

    const group: PlayerGroup = req.ctx.state.group
    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = this.buildRulesFromData(rules)
    await group.checkMembership(em)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_UPDATED,
      extra: {
        groupName: req.ctx.state.group.name
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        group
      }
    }
  }

  async rules(): Promise<Response> {
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

  @HasPermission(PlayerGroupPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_DELETED,
      extra: {
        groupName: req.ctx.state.group.name
      }
    })

    await em.removeAndFlush(req.ctx.state.group)

    return {
      status: 204
    }
  }

  @Validate({
    query: {
      rules: {
        required: true,
        validation: (val) => rulesValidation(JSON.parse(decodeURI(val as string)))
      },
      ruleMode: {
        required: true,
        validation: ruleModeValidation
      }
    }
  })
  @HasPermission(PlayerGroupPolicy, 'index')
  async previewCount(req: Request): Promise<Response> {
    const { rules, ruleMode } = req.query
    const em: EntityManager = req.ctx.em

    const group = new PlayerGroup(req.ctx.state.game)
    group.rules = this.buildRulesFromData(JSON.parse(decodeURI(rules)))
    group.ruleMode = ruleMode as RuleMode

    const count = await group.getQuery(em).getCount()

    return {
      status: 200,
      body: {
        count
      }
    }
  }
}
