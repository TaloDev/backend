import AdminAPIKey, { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'
import { generateAdminAPIKey } from './common.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      scopes: z.array(z.enum(AdminAPIKeyScope)).nonempty(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create admin API keys'),
    requireEmailConfirmed('create admin API keys'),
    loadGame,
  ),
  handler: async (ctx) => {
    const { scopes } = ctx.state.validated.body
    const em = ctx.em

    const { key, keyHash, keyEnding } = generateAdminAPIKey()
    const apiKey = new AdminAPIKey({
      game: ctx.state.game,
      createdByUser: ctx.state.user,
      keyHash,
      keyEnding,
    })
    apiKey.scopes = scopes

    await em.persist(apiKey).flush()

    createGameActivity(em, {
      actor: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.ADMIN_API_KEY_CREATED,
      extra: {
        keyId: apiKey.id,
        display: {
          'Key ending in': keyEnding,
          Scopes: scopes.join(', '),
        },
      },
    })

    await em.flush()

    return {
      status: 200,
      body: {
        key,
        apiKey,
      },
    }
  },
})
