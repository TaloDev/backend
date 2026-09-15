import APIKey from '../../../entities/api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Game from '../../../entities/game.js'
import Player from '../../../entities/player.js'
import { UserType } from '../../../entities/user.js'
import { getTokenCacheKey } from '../../../lib/auth/getAPIKeyFromToken.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

function throwUnlessOwner(ctx: ProtectedRouteContext) {
  if (ctx.state.user.type !== UserType.OWNER) {
    return ctx.throw(403, 'You do not have permissions to update game settings')
  }
}

export const updateRoute = protectedRoute({
  method: 'patch',
  path: '/:gameId',
  schema: (z) => ({
    body: z.object({
      name: z.string().trim().min(1, 'Name must be a non-empty string').optional(),
      purgeDevPlayers: z.boolean().optional(),
      purgeLivePlayers: z.boolean().optional(),
      purgeDevPlayersRetention: z.number().optional(),
      purgeLivePlayersRetention: z.number().optional(),
      website: z.string().nullable().optional(),
      blockAliasIdentifierProfanity: z.boolean().optional(),
      blockPropsProfanity: z.boolean().optional(),
      verifyRequests: z.boolean().optional(),
      displayNamePropKey: z.string().nullable().optional(),
      logoUrl: z.string().nullable().optional(),
      playerAuthActivityEnrichment: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'update games'), loadGame),
  handler: async (ctx) => {
    const {
      name,
      purgeDevPlayers,
      purgeLivePlayers,
      purgeDevPlayersRetention,
      purgeLivePlayersRetention,
      website,
      blockAliasIdentifierProfanity,
      blockPropsProfanity,
      verifyRequests,
      displayNamePropKey,
      logoUrl,
      playerAuthActivityEnrichment,
    } = ctx.state.validated.body

    const em = ctx.em
    const game = ctx.state.game

    if (typeof name === 'string') {
      const prevName = game.name
      game.name = name

      createGameActivity(em, {
        actor: ctx.state.user,
        game,
        type: GameActivityType.GAME_NAME_UPDATED,
        extra: {
          display: {
            'Previous name': prevName,
          },
        },
      })
    }

    const settingsToUpdate: Partial<Game> = {}

    if (typeof purgeDevPlayers === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.purgeDevPlayers = purgeDevPlayers
    }
    if (typeof purgeLivePlayers === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.purgeLivePlayers = purgeLivePlayers
    }
    if (typeof purgeDevPlayersRetention === 'number') {
      throwUnlessOwner(ctx)
      settingsToUpdate.purgeDevPlayersRetention = purgeDevPlayersRetention
    }
    if (typeof purgeLivePlayersRetention === 'number') {
      throwUnlessOwner(ctx)
      settingsToUpdate.purgeLivePlayersRetention = purgeLivePlayersRetention
    }
    if (typeof website === 'string') {
      throwUnlessOwner(ctx)
      settingsToUpdate.website = website
    }
    if (typeof blockAliasIdentifierProfanity === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.blockAliasIdentifierProfanity = blockAliasIdentifierProfanity
    }
    if (typeof blockPropsProfanity === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.blockPropsProfanity = blockPropsProfanity
    }
    if (typeof verifyRequests === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.verifyRequests = verifyRequests
    }
    if (typeof displayNamePropKey === 'string') {
      throwUnlessOwner(ctx)
      settingsToUpdate.displayNamePropKey = displayNamePropKey
    }
    if (typeof logoUrl === 'string') {
      throwUnlessOwner(ctx)
      settingsToUpdate.logoUrl = logoUrl
    }
    if (typeof playerAuthActivityEnrichment === 'boolean') {
      throwUnlessOwner(ctx)
      settingsToUpdate.playerAuthActivityEnrichment = playerAuthActivityEnrichment
    }

    const [, changedProperties] = updateAllowedKeys(game, settingsToUpdate, [
      'purgeDevPlayers',
      'purgeLivePlayers',
      'purgeDevPlayersRetention',
      'purgeLivePlayersRetention',
      'blockAliasIdentifierProfanity',
      'blockPropsProfanity',
      'verifyRequests',
      'displayNamePropKey',
      'website',
      'logoUrl',
      'playerAuthActivityEnrichment',
    ])

    if (changedProperties.length > 0) {
      createGameActivity(em, {
        actor: ctx.state.user,
        game,
        type: GameActivityType.GAME_SETTINGS_UPDATED,
        extra: {
          display: {
            'Updated properties': changedProperties
              .map((prop) => `${prop}: ${settingsToUpdate[prop as keyof Game]}`)
              .join(', '),
          },
        },
      })

      const apiKeys = await em.repo(APIKey).find({ game })
      await Promise.all(
        apiKeys.map((key) => {
          return em.clearCache(getTokenCacheKey(key.id))
        }),
      )

      if (changedProperties.includes('displayNamePropKey')) {
        await deferClearResponseCache(Player.getSearchCacheKey(game, true))
      }
    }

    await em.flush()

    return {
      status: 200,
      body: {
        game,
      },
    }
  },
})
