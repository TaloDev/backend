import { EntityManager } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import User from '../../../entities/user'
import Game from '../../../entities/game'
import Leaderboard, { LeaderboardSortMode, LeaderboardRefreshInterval } from '../../../entities/leaderboard'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'

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
  uniqueByProps = false
}: CreateLeaderboardParams) {
  const duplicateInternalName = await em.repo(Leaderboard).findOne({
    internalName,
    game
  })

  if (duplicateInternalName) {
    return buildErrorResponse({
      internalName: [`A leaderboard with the internalName '${internalName}' already exists`]
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
      leaderboardInternalName: leaderboard.internalName
    }
  })

  await em.persist(leaderboard).flush()

  await triggerIntegrations(em, leaderboard.game, (integration) => {
    return integration.handleLeaderboardCreated(em, leaderboard)
  })

  return {
    status: 200,
    body: {
      leaderboard
    }
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
        error: `Sort mode must be one of ${sortModeValues}`
      }),
      unique: z.boolean(),
      refreshInterval: z.enum(LeaderboardRefreshInterval, {
        error: `Refresh interval must be one of ${refreshIntervalValues}`
      }).optional(),
      uniqueByProps: z.boolean().optional()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create leaderboards'),
    loadGame
  ),
  handler: async (ctx) => {
    const { internalName, name, sortMode, unique, refreshInterval, uniqueByProps } = ctx.state.validated.body

    return createLeaderboardHandler({
      em: ctx.em,
      game: ctx.state.game,
      user: ctx.state.authenticatedUser,
      internalName,
      name,
      sortMode,
      unique,
      refreshInterval,
      uniqueByProps
    })
  }
})
