import { GameActivityType } from '../../../entities/game-activity'
import PlayerGroup from '../../../entities/player-group'
import { UserType } from '../../../entities/user'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { groupBodySchema, buildRulesFromData, loadGroup } from './common'

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: groupBodySchema(z),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'update groups'),
    loadGame,
    loadGroup,
  ),
  handler: async (ctx) => {
    const { name, description, ruleMode, rules, membersVisible } = ctx.state.validated.body
    const em = ctx.em
    const group = ctx.state.group

    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = buildRulesFromData(rules)
    group.membersVisible = membersVisible

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.PLAYER_GROUP_UPDATED,
      extra: {
        groupName: group.name,
      },
    })

    await group.checkMembership(em)
    await em.clearCache(PlayerGroup.getCacheKey(group.game))

    return {
      status: 200,
      body: {
        group: await group.toJSONWithCount(ctx.state.includeDevData),
      },
    }
  },
})
