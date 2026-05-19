import { EntityManager } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity.js'
import Game from '../../../entities/game.js'
import Leaderboard, {
  LeaderboardSortMode,
  LeaderboardRefreshInterval,
} from '../../../entities/leaderboard.js'
import { UserType } from '../../../entities/user.js'
import User from '../../../entities/user.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

type CreateLeaderboardParams = {
  em: EntityManager
  game: Game
  user: User
  internalName: string
  name: string
  sortMode: LeaderboardSortMode
  unique: boolean
  refreshInterval?: LeaderboardRefreshInterval
  uniqueByProps?: boolean
}

export async function createLeaderboardHandler({
  em,
  game,
  user,
  internalName,
  name,
  sortMode,
  unique,
  refreshInterval = LeaderboardRefreshInterval.NEVER,
  uniqueByProps = false,
}: CreateLeaderboardParams) {
  const duplicateInternalName = await em.repo(Leaderboard).findOne({
    internalName,
    game,
  })

  if (duplicateInternalName) {
    return buildErrorResponse({
      internalName: [`A leaderboard with the internalName '${internalName}' already exists`],
    })
  }

  const leaderboard = new Leaderboard(game)
  leaderboard.internalName = internalName
  leaderboard.name = name
  leaderboard.sortMode = sortMode
  leaderboard.unique = unique
  leaderboard.refreshInterval = refreshInterval
  leaderboard.uniqueByProps = uniqueByProps

  createGameActivity(em, {
    user,
    game: leaderboard.game,
    type: GameActivityType.LEADERBOARD_CREATED,
    extra: {
      leaderboardInternalName: leaderboard.internalName,
    },
  })

  await em.persist(leaderboard).flush()

  await triggerIntegrations(em, leaderboard.game, (integration) => {
    return integration.handleLeaderboardCreated(em, leaderboard)
  })

  return {
    status: 200,
    body: {
      leaderboard,
    },
  }
}

const sortModeValues = Object.values(LeaderboardSortMode).join(', ')
const refreshIntervalValues = Object.values(LeaderboardRefreshInterval).join(', ')

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      internalName: z.string(),
      name: z.string(),
      sortMode: z.enum(LeaderboardSortMode, {
        error: `Sort mode must be one of ${sortModeValues}`,
      }),
      unique: z.boolean(),
      refreshInterval: z
        .enum(LeaderboardRefreshInterval, {
          error: `Refresh interval must be one of ${refreshIntervalValues}`,
        })
        .optional(),
      uniqueByProps: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create leaderboards'),
    loadGame,
  ),
  handler: async (ctx) => {
    const { internalName, name, sortMode, unique, refreshInterval, uniqueByProps } =
      ctx.state.validated.body

    return createLeaderboardHandler({
      em: ctx.em,
      game: ctx.state.game,
      user: ctx.state.user,
      internalName,
      name,
      sortMode,
      unique,
      refreshInterval,
      uniqueByProps,
    })
  },
})
