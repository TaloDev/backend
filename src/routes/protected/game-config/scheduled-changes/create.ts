import { EntityManager } from '@mikro-orm/mysql'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../../../../entities/game.js'
import ScheduledGameConfigChange from '../../../../entities/scheduled-game-config-change.js'
import User, { UserType } from '../../../../entities/user.js'
import { buildErrorResponse } from '../../../../lib/errors/buildErrorResponse.js'
import {
  applyPropsInOrder,
  isReservedPropKey,
  RESERVED_PROP_KEY_MESSAGE,
} from '../../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../../lib/routing/router.js'
import { loadGame } from '../../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../../middleware/policy-middleware.js'
import {
  createScheduledGameConfigChangesBodySchema,
  ScheduledGameConfigChangesData,
} from './common.js'

function validateChanges(game: Game, data: ScheduledGameConfigChangesData) {
  if (data.changes.some((change) => isReservedPropKey(change.key))) {
    return buildErrorResponse({ props: [RESERVED_PROP_KEY_MESSAGE] })
  }

  // mirror the scheduled task so changes that would be rejected at apply time fail here instead
  const { rejected } = applyPropsInOrder({
    prevProps: game.props,
    changes: data.changes,
    valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH,
  })

  if (rejected.length > 0) {
    return buildErrorResponse(
      { props: ['One or more props are invalid, see rejectedProps'] },
      { rejectedProps: rejected.flatMap((result) => result.reasons) },
    )
  }

  return null
}

export async function createScheduledGameConfigChangesHandler({
  em,
  game,
  actor,
  data,
}: {
  em: EntityManager
  game: Game
  actor: User
  data: ScheduledGameConfigChangesData
}) {
  const error = validateChanges(game, data)
  if (error) {
    return error
  }

  const changes = data.changes.map(
    (change) =>
      new ScheduledGameConfigChange(
        game,
        actor,
        change.key,
        change.value,
        new Date(change.applyAt),
      ),
  )

  await em.persist(changes).flush()

  return {
    status: 200,
    body: {
      changes,
    },
  }
}

export const createScheduledChangeRoute = protectedRoute({
  method: 'post',
  path: '/scheduled-changes',
  schema: (z) => ({
    body: createScheduledGameConfigChangesBodySchema(z),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'schedule game config changes'),
    loadGame,
  ),
  handler: (ctx) =>
    createScheduledGameConfigChangesHandler({
      em: ctx.em,
      game: ctx.state.game,
      actor: ctx.state.user,
      data: ctx.state.validated.body,
    }),
})
