import { pick } from 'lodash'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import Integration, { IntegrationConfig, IntegrationType } from '../../../entities/integration'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { configKeys } from './common'

const integrationTypeValues = Object.values(IntegrationType).join(', ')

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      type: z.nativeEnum(IntegrationType, {
        message: `Integration type must be one of ${integrationTypeValues}`
      }),
      config: z.object({
        apiKey: z.string().optional(),
        appId: z.number().optional(),
        syncLeaderboards: z.boolean().optional(),
        syncStats: z.boolean().optional()
      })
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'add integrations'),
    loadGame
  ),
  handler: async (ctx) => {
    const { type, config } = ctx.state.validated.body
    const em = ctx.em

    const existingIntegration = await em.repo(Integration).findOne({
      type,
      game: ctx.state.game
    })

    if (existingIntegration) {
      ctx.throw(400, `This game already has an integration for ${type}`)
    }

    const integration = new Integration(
      type,
      ctx.state.game,
      pick(config, configKeys[type]) as IntegrationConfig
    )

    createGameActivity(em, {
      user: ctx.state.authenticatedUser,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_ADDED,
      extra: {
        integrationType: integration.type
      }
    })

    await em.persist(integration).flush()

    return {
      status: 200,
      body: {
        integration
      }
    }
  }
})
