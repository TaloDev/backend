import GameStat from '../../../entities/game-stat.js'
import { UserType } from '../../../entities/user.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { clearStatIndexResponseCache, createStatBodySchema } from './common.js'
import { createStatHandler } from './create.js'

export const bulkCreateRoute = protectedRoute({
  method: 'post',
  path: '/bulk',
  schema: (z) => ({
    body: z.object({
      stats: z.array(createStatBodySchema(z)).nonempty(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'create stats'),
    loadGame,
    clearStatIndexResponseCache,
  ),
  handler: async (ctx) => {
    const { stats: items } = ctx.state.validated.body
    const errors: string[][] = Array.from({ length: items.length }, () => [])
    const createdStats: GameStat[] = []

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await createStatHandler({
          em: ctx.em,
          game: ctx.state.game,
          user: ctx.state.user,
          data: items[i],
        })
        if ('errors' in result.body) {
          errors[i].push(...Object.values(result.body.errors).flat())
        } else {
          createdStats.push(result.body.stat)
        }
      } catch (err) {
        errors[i].push((err as Error).message)
      }
    }

    return {
      status: 200,
      body: { stats: createdStats, errors },
    }
  },
})
