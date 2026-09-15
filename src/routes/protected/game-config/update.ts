import { GameActivityType } from '../../../entities/game-activity.js'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../../../entities/game.js'
import { UserType } from '../../../entities/user.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import {
  isReservedPropKey,
  mergeAndSanitiseProps,
  RESERVED_PROP_KEY_MESSAGE,
  sanitiseProps,
} from '../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const updateRoute = protectedRoute({
  method: 'patch',
  schema: (z) => ({
    body: z.object({
      props: updatePropsSchema,
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'update game config'), loadGame),
  handler: async (ctx) => {
    const { props } = ctx.state.validated.body
    const em = ctx.em
    const game = ctx.state.game

    if (props.some((prop) => isReservedPropKey(prop.key))) {
      return buildErrorResponse({ props: [RESERVED_PROP_KEY_MESSAGE] })
    }

    const { accepted, rejected } = mergeAndSanitiseProps({
      prevProps: game.props,
      newProps: props,
      valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH,
    })

    if (rejected.length > 0) {
      return buildErrorResponse(
        { props: ['One or more props are invalid, see rejectedProps'] },
        { rejectedProps: rejected },
      )
    }

    game.props = accepted

    createGameActivity(em, {
      actor: ctx.state.user,
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

    await em.flush()

    await em.clearCache(Game.getLiveConfigCacheKey(game))
    game.notifyLiveConfigUpdated(ctx.wss)

    return {
      status: 200,
      body: {
        game,
      },
    }
  },
})
