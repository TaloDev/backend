import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { getTokenCacheKey } from '../../../lib/auth/getAPIKeyFromToken'
import { loadAPIKey, createToken } from './common'
import { APIKeyScope } from '../../../entities/api-key'

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      scopes: z.array(z.enum(APIKeyScope))
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update API keys'),
    requireEmailConfirmed('update API keys'),
    loadGame,
    loadAPIKey
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const apiKey = ctx.state.apiKey

    await em.populate(apiKey, ['createdByUser'])

    apiKey.scopes = ctx.state.validated.body.scopes
    await em.clearCache(getTokenCacheKey(apiKey.id))

    const token = await createToken(em, apiKey)

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
      type: GameActivityType.API_KEY_UPDATED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': token.substring(token.length - 5, token.length),
          'Scopes': apiKey.scopes.join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        apiKey
      }
    }
  }
})
