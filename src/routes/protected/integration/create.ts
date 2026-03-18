import { pick } from 'lodash'
import { GameActivityType } from '../../../entities/game-activity'
import Integration, { IntegrationConfig, IntegrationType } from '../../../entities/integration'
import { UserType } from '../../../entities/user'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { configKeys } from './common'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.discriminatedUnion('type', [
      z.object({
        type: z.literal(IntegrationType.STEAMWORKS),
        config: z.object({
          apiKey: z.string(),
          appId: z.number(),
          syncLeaderboards: z.boolean().optional(),
          syncStats: z.boolean().optional(),
        }),
      }),
      z.object({
        type: z.literal(IntegrationType.GOOGLE_PLAY_GAMES),
        config: z.object({
          clientId: z.string(),
          clientSecret: z.string(),
        }),
      }),
    ]),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'add integrations'), loadGame),
  handler: async (ctx) => {
    const { type, config } = ctx.state.validated.body
    const em = ctx.em

    const existingIntegration = await em.repo(Integration).findOne({
      type,
      game: ctx.state.game,
    })

    if (existingIntegration) {
      return ctx.throw(400, `This game already has an integration for ${type}`)
    }

    const integration = new Integration(
      type,
      ctx.state.game,
      pick(config, configKeys[type]) as IntegrationConfig,
    )

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_ADDED,
      extra: {
        integrationType: integration.type,
      },
    })

    await em.persist(integration).flush()

    return {
      status: 200,
      body: {
        integration,
      },
    }
  },
})
