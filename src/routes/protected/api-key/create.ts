import APIKey, { APIKeyScope } from '../../../entities/api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'
import { createToken } from './common.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      scopes: z.array(z.enum(APIKeyScope)).nonempty(),
      name: z.string().trim().min(1).max(255).optional(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create API keys'),
    requireEmailConfirmed('create API keys'),
    loadGame,
  ),
  handler: async (ctx) => {
    const { scopes, name } = ctx.state.validated.body
    const em = ctx.em

    const apiKey = new APIKey(ctx.state.game, ctx.state.user)
    apiKey.scopes = scopes
    apiKey.name = name ?? ''
    await em.persist(apiKey).flush()

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.API_KEY_CREATED,
      extra: {
        keyId: apiKey.id,
        display: {
          ...(apiKey.name ? { Name: apiKey.name } : {}),
          Scopes: scopes.join(', '),
        },
      },
    })

    await em.flush()

    const token = await createToken(em, apiKey)

    return {
      status: 200,
      body: {
        token,
        apiKey,
      },
    }
  },
})
