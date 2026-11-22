import { EntityManager } from '@mikro-orm/mysql'
import { z } from 'zod'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../../../entities/game.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { mergeAndSanitiseProps, sanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import Socket from '../../../socket/index.js'
import { updateGameConfigBodySchema } from '../../schemas/game-config/updateGameConfigBodySchema.js'
import { buildPropsError } from './common.js'

export async function updateGameConfigHandler({
  em,
  game,
  actor,
  props,
  wss,
}: {
  em: EntityManager
  game: Game
  actor: User | AdminAPIKey
  props: z.infer<typeof updatePropsSchema>
  wss: Socket
}) {
  const { accepted, rejected } = mergeAndSanitiseProps({
    prevProps: game.props,
    newProps: props,
    valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH,
  })

  const propsError = buildPropsError(rejected)
  if (propsError) {
    return propsError
  }

  game.props = accepted

  createGameActivity(em, {
    actor,
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
  game.notifyLiveConfigUpdated(wss)

  return {
    status: 200,
    body: {
      game,
    },
  }
}

export const updateRoute = protectedRoute({
  method: 'patch',
  schema: (z) => ({
    body: updateGameConfigBodySchema(z),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'update game config'), loadGame),
  handler: (ctx) =>
    updateGameConfigHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.user,
      props: ctx.state.validated.body.props,
      wss: ctx.wss,
    }),
})
