import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import APIKey, { APIKeyScope } from '../../../entities/api-key'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { createToken } from './common'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      scopes: z.array(z.nativeEnum(APIKeyScope)).nonempty()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create API keys'),
    requireEmailConfirmed('create API keys'),
    loadGame
  ),
  handler: async (ctx) => {
    const { scopes } = ctx.state.validated.body
    const em = ctx.em

    const apiKey = new APIKey(ctx.state.game, ctx.state.authenticatedUser)
    apiKey.scopes = scopes

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
      type: GameActivityType.API_KEY_CREATED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Scopes': scopes.join(', ')
        }
      }
    })

    await em.persist(apiKey).flush()

    const token = await createToken(em, apiKey)

    return {
      status: 200,
      body: {
        token,
        apiKey
      }
    }
  }
})
