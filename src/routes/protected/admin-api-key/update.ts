import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import { getAdminTokenCacheKey } from '../../../lib/auth/getAdminAPIKeyFromToken.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'
import { loadAdminAPIKey } from './common.js'

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      scopes: z.array(z.enum(AdminAPIKeyScope)).optional(),
      name: z.string().trim().min(1).max(255).optional(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update admin API keys'),
    requireEmailConfirmed('update admin API keys'),
    loadGame,
    loadAdminAPIKey,
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKey = ctx.state.adminAPIKey
    const { scopes, name } = ctx.state.validated.body

    await em.populate(apiKey, ['createdByUser'])

    if (name !== undefined) {
      apiKey.name = name
    }

    if (scopes !== undefined) {
      apiKey.scopes = scopes
      await em.clearCache(getAdminTokenCacheKey(apiKey.keyHash))
    }

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.ADMIN_API_KEY_UPDATED,
      extra: {
        keyId: apiKey.id,
        display: {
          ...(apiKey.name ? { Name: apiKey.name } : {}),
          'Key ending in': apiKey.keyEnding,
          Scopes: apiKey.scopes.join(', '),
        },
      },
    })

    await em.flush()

    return {
      status: 200,
      body: {
        apiKey,
      },
    }
  },
})
