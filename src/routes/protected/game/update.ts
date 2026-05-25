import { APIKeyScope } from '../../../entities/api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../../../entities/game.js'
import { UserType } from '../../../entities/user.js'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { mergeAndSanitiseProps, sanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { sendMessages } from '../../../socket/messages/socketMessage.js'

function sendLiveConfigUpdatedMessage(ctx: ProtectedRouteContext, game: Game) {
  const socket = ctx.wss
  const conns = socket.findConnections((conn) => {
    return conn.gameId === game.id && conn.hasScope(APIKeyScope.READ_GAME_CONFIG)
  })
  sendMessages(conns, 'v1.live-config.updated', {
    config: game.getLiveConfig(),
  })
}

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
      props: updatePropsSchema.optional(),
      purgeDevPlayers: z.boolean().optional(),
      purgeLivePlayers: z.boolean().optional(),
      purgeDevPlayersRetention: z.number().optional(),
      purgeLivePlayersRetention: z.number().optional(),
      website: z.string().nullable().optional(),
      blockAliasIdentifierProfanity: z.boolean().optional(),
      blockPropsProfanity: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'update games'), loadGame),
  handler: async (ctx) => {
    const {
      name,
      props,
      purgeDevPlayers,
      purgeLivePlayers,
      purgeDevPlayersRetention,
      purgeLivePlayersRetention,
      website,
      blockAliasIdentifierProfanity,
      blockPropsProfanity,
    } = ctx.state.validated.body

    const em = ctx.em
    const game = ctx.state.game

    try {
      if (typeof name === 'string') {
        const prevName = game.name
        game.name = name

        createGameActivity(em, {
          user: ctx.state.user,
          game,
          type: GameActivityType.GAME_NAME_UPDATED,
          extra: {
            display: {
              'Previous name': prevName,
            },
          },
        })
      }

      if (Array.isArray(props)) {
        if (props.some((prop) => prop.key.startsWith('META_'))) {
          return buildErrorResponse({
            props: [
              "Prop keys starting with 'META_' are reserved for internal systems, please use another key name",
            ],
          })
        }

        const { accepted, rejected } = mergeAndSanitiseProps({
          prevProps: game.props,
          newProps: props,
          valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH,
        })
        if (rejected.length > 0) {
          throw new PropRejectionError(rejected)
        }
        game.props = accepted

        await em.clearCache(Game.getLiveConfigCacheKey(game))
        sendLiveConfigUpdatedMessage(ctx, game)

        createGameActivity(em, {
          user: ctx.state.user,
          game,
          type: GameActivityType.GAME_PROPS_UPDATED,
          extra: {
            display: {
              'Updated props': sanitiseProps({ props })
                .map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`)
                .join(', '),
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

      const [, changedProperties] = updateAllowedKeys(game, settingsToUpdate, [
        'purgeDevPlayers',
        'purgeLivePlayers',
        'purgeDevPlayersRetention',
        'purgeLivePlayersRetention',
        'blockAliasIdentifierProfanity',
        'blockPropsProfanity',
        'website',
      ])

      if (changedProperties.length > 0) {
        createGameActivity(em, {
          user: ctx.state.user,
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
      }

      await em.flush()

      return {
        status: 200,
        body: {
          game,
        },
      }
    } catch (err) {
      if (err instanceof PropRejectionError) {
        return buildErrorResponse({ props: [err.message] }, { rejectedProps: err.rejected })
      }
      throw err
    }
  },
})
