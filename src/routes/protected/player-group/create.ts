import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import PlayerGroup from '../../../entities/player-group'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { groupBodySchema, buildRulesFromData } from './common'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: groupBodySchema(z)
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create groups'),
    loadGame
  ),
  handler: async (ctx) => {
    const { name, description, ruleMode, rules, membersVisible } = ctx.state.validated.body
    const em = ctx.em

    const group = new PlayerGroup(ctx.state.game)
    group.name = name
    group.description = description
    group.ruleMode = ruleMode
    group.rules = buildRulesFromData(rules)
    group.membersVisible = membersVisible
    em.persist(group)

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
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
        group: await group.toJSONWithCount(ctx.state.includeDevData)
      }
    }
  }
})
