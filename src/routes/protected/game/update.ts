import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { mergeAndSanitiseProps, sanitiseProps } from '../../../lib/props/sanitiseProps'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../../../entities/game'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import updateAllowedKeys from '../../../lib/entities/updateAllowedKeys'
import { sendMessages } from '../../../socket/messages/socketMessage'
import { APIKeyScope } from '../../../entities/api-key'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { loadGame } from '../../../middleware/game-middleware'
import { updatePropsSchema } from '../../../lib/validation/propsSchema'

async function sendLiveConfigUpdatedMessage(ctx: ProtectedRouteContext, game: Game) {
  const socket = ctx.wss
  const conns = socket.findConnections((conn) => {
    return conn.gameId === game.id && conn.hasScope(APIKeyScope.READ_GAME_CONFIG)
  })
  await sendMessages(conns, 'v1.live-config.updated', {
    config: game.getLiveConfig()
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
      website: z.string().nullable().optional()
    })
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
      website
    } = ctx.state.validated.body

    const em = ctx.em
    const game = ctx.state.game

    if (typeof name === 'string') {
      const prevName = game.name
      game.name = name

      createGameActivity(em, {
        user: ctx.state.user,
        game,
        type: GameActivityType.GAME_NAME_UPDATED,
        extra: {
          display: {
            'Previous name': prevName
          }
        }
      })
    }

    if (Array.isArray(props)) {
      if (props.some((prop) => prop.key.startsWith('META_'))) {
        return buildErrorResponse({ props: ['Prop keys starting with \'META_\' are reserved for internal systems, please use another key name'] })
      }

      try {
        game.props = mergeAndSanitiseProps({
          prevProps: game.props,
          newProps: props,
          valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH
        })
      } catch (err) {
        if (err instanceof PropSizeError) {
          return buildErrorResponse({ props: [err.message] })
        /* v8 ignore start */
        }
        throw err
        /* v8 ignore stop */
      }

      await em.clearCache(Game.getLiveConfigCacheKey(game))
      await sendLiveConfigUpdatedMessage(ctx, game)

      createGameActivity(em, {
        user: ctx.state.user,
        game,
        type: GameActivityType.GAME_PROPS_UPDATED,
        extra: {
          display: {
            'Updated props': sanitiseProps({ props }).map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`).join(', ')
          }
        }
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

    const [, changedProperties] = updateAllowedKeys(
      game,
      settingsToUpdate,
      ['purgeDevPlayers', 'purgeLivePlayers', 'purgeDevPlayersRetention', 'purgeLivePlayersRetention', 'website']
    )

    if (changedProperties.length > 0) {
      createGameActivity(em, {
        user: ctx.state.user,
        game,
        type: GameActivityType.GAME_SETTINGS_UPDATED,
        extra: {
          display: {
            'Updated properties': changedProperties.map((prop) => `${prop}: ${settingsToUpdate[prop as keyof Game]}`).join(', ')
          }
        }
      })
    }

    await em.flush()

    return {
      status: 200,
      body: {
        game
      }
    }
  }
})
