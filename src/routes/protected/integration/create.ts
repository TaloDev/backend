import { pick } from 'lodash-es'
import { GameActivityType } from '../../../entities/game-activity.js'
import Integration, { IntegrationConfig, IntegrationType } from '../../../entities/integration.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { configKeys, findDuplicateAppIdentity } from './common.js'

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
      z.object({
        type: z.literal(IntegrationType.GAME_CENTER),
        config: z.object({
          bundleId: z.string(),
        }),
      }),
    ]),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'add integrations'), loadGame),
  handler: async (ctx) => {
    const { type, config } = ctx.state.validated.body
    const em = ctx.em

    const identityKey = await findDuplicateAppIdentity({
      ctx,
      type,
      config,
    })
    if (identityKey) {
      return ctx.throw(
        400,
        `This game already has an integration for ${type} with this ${identityKey}`,
      )
    }

    const integration = new Integration(
      type,
      ctx.state.game,
      pick(config, configKeys[type]) as IntegrationConfig,
    )

    createGameActivity(em, {
      actor: ctx.state.user,
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
