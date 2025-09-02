import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import { GameActivityType } from '../entities/game-activity'
import PlayerGroup, { PlayerRuleFields, RuleMode } from '../entities/player-group'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../entities/player-group-rule'
import { ruleModeValidation, rulesValidation } from '../lib/groups/rulesValidation'
import createGameActivity from '../lib/logging/createGameActivity'
import PlayerGroupPolicy from '../policies/player-group.policy'
import getUserFromToken from '../lib/auth/getUserFromToken'
import UserPinnedGroup from '../entities/user-pinned-group'
import { getResultCacheOptions } from '../lib/perf/getResultCacheOptions'

export default class PlayerGroupService extends Service {
  @Route({
    method: 'GET'
  })
  @HasPermission(PlayerGroupPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const groups = await em.getRepository(PlayerGroup).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        groups: await Promise.all(groups.map((group) => group.toJSONWithCount(req.ctx.state.includeDevData)))
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

  @Route({
    method: 'POST'
  })
  @Validate({ body: [PlayerGroup] })
  @HasPermission(PlayerGroupPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name, description, ruleMode, rules, membersVisible } = req.body
    const em: EntityManager = req.ctx.em

    const group = new PlayerGroup(req.ctx.state.game)
    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = this.buildRulesFromData(rules)
    group.membersVisible = membersVisible
    em.persist(group)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_CREATED,
      extra: {
        groupName: group.name
      }
    })

    await group.checkMembership(em)
    await em.clearCache(PlayerGroup.getCacheKey(group.game))

    return {
      status: 200,
      body: {
        group: await group.toJSONWithCount(req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id'
  })
  @Validate({ body: [PlayerGroup] })
  @HasPermission(PlayerGroupPolicy, 'put')
  async put(req: Request): Promise<Response> {
    const { name, description, ruleMode, rules, membersVisible } = req.body
    const em: EntityManager = req.ctx.em

    const group: PlayerGroup = req.ctx.state.group
    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = this.buildRulesFromData(rules)
    group.membersVisible = membersVisible

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_UPDATED,
      extra: {
        groupName: req.ctx.state.group.name
      }
    })

    await group.checkMembership(em)
    await em.clearCache(PlayerGroup.getCacheKey(group.game))

    return {
      status: 200,
      body: {
        group: await group.toJSONWithCount(req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/rules'
  })
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

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
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

    await em.getRepository(UserPinnedGroup).nativeDelete({ group: req.ctx.state.group })
    await em.removeAndFlush(req.ctx.state.group)
    await em.clearCache(PlayerGroup.getCacheKey(req.ctx.state.game))

    return {
      status: 204
    }
  }

  @Route({
    method: 'GET',
    path: '/preview-count'
  })
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

    const query = group.getQuery(em)
    if (!req.ctx.state.includeDevData) {
      query.andWhere({ devBuild: false })
    }
    const count = await query.getCount()

    return {
      status: 200,
      body: {
        count
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/pinned'
  })
  @HasPermission(PlayerGroupPolicy, 'indexPinned')
  async indexPinned(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const pinnedGroups = await em.getRepository(UserPinnedGroup).find({
      user,
      group: {
        game: req.ctx.state.game
      }
    }, {
      orderBy: { createdAt: 'desc' },
      ...getResultCacheOptions(`pinned-groups-${user.id}-${req.ctx.state.game.id}`)
    })

    const groups = await Promise.all(pinnedGroups.map(({ group }) => group.toJSONWithCount(req.ctx.state.includeDevData)))

    return {
      status: 200,
      body: {
        groups
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id/toggle-pinned'
  })
  @HasPermission(PlayerGroupPolicy, 'togglePinned')
  async togglePinned(req: Request): Promise<Response> {
    const { pinned } = req.body
    const em: EntityManager = req.ctx.em

    const group: PlayerGroup = req.ctx.state.group
    const user = await getUserFromToken(req.ctx)

    const pinnedGroup = await em.getRepository(UserPinnedGroup).findOne({ user, group })
    if (pinned && !pinnedGroup) {
      em.persist(new UserPinnedGroup(user, group))
    } else if (!pinned && pinnedGroup) {
      em.remove(pinnedGroup)
    }

    await em.flush()

    return {
      status: 204
    }
  }
}
