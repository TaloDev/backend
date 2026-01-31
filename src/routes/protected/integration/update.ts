import { pick } from 'lodash'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { loadIntegration, configKeys } from './common'

export const updateRoute = protectedRoute({
  method: 'patch',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      config: z.object({
        apiKey: z.string().optional(),
        appId: z.number().optional(),
        syncLeaderboards: z.boolean().optional(),
        syncStats: z.boolean().optional()
      })
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'update integrations'),
    loadIntegration
  ),
  handler: async (ctx) => {
    const { config } = ctx.state.validated.body
    const em = ctx.em

    const integration = ctx.state.integration
    const newConfig = pick(config, configKeys[integration.type])
    integration.updateConfig(newConfig)

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_UPDATED,
      extra: {
        integrationType: integration.type,
        display: {
          'Updated properties': Object.keys(newConfig).join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        integration
      }
    }
  }
})
