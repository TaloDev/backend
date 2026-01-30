import { EntityManager, LockMode } from '@mikro-orm/mysql'
import Player from '../../../entities/player'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { sanitiseProps, mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import { userTypeGate } from '../../../middleware/policy-middleware'
import User, { UserType } from '../../../entities/user'
import { loadPlayer } from './common'
import { loadGame } from '../../../middleware/game-middleware'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'

type UpdatePlayerParams = {
  em: EntityManager
  player: Player
  props?: {
    key: string
    value: string | null
  }[]
  forwarded?: boolean
  user?: User
}

export async function updatePlayerHandler({
  em,
  player,
  props,
  forwarded,
  user
}: UpdatePlayerParams) {
  const {
    player: updatedPlayer,
    errorMessage
  } = await em.transactional(async (trx) => {
    const lockedPlayer = await trx.refreshOrFail(player, { lockMode: LockMode.PESSIMISTIC_WRITE })

    if (props) {
      if (!forwarded && props.some((prop) => prop.key.startsWith('META_'))) {
        return {
          player: null,
          errorMessage: 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name'
        }
      }

      try {
        lockedPlayer.setProps(mergeAndSanitiseProps({
          prevProps: lockedPlayer.props.getItems(),
          newProps: props,
          extraFilter: (prop) => !prop.key.startsWith('META_')
        }))
      } catch (err) {
        if (err instanceof PropSizeError) {
          return {
            player: null,
            errorMessage: err.message
          }
        }
        throw err
      }

      if (!forwarded && user) {
        createGameActivity(trx, {
          user,
          game: player.game,
          type: GameActivityType.PLAYER_PROPS_UPDATED,
          extra: {
            playerId: player.id,
            display: {
              'Player': player.id,
              'Updated props': sanitiseProps({ props }).map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`).join(', ')
            }
          }
        })
      }
    }

    return {
      player: lockedPlayer,
      errorMessage: null
    }
  })

  if (errorMessage) {
    return buildErrorResponse({
      props: [errorMessage]
    })
  }

  if (updatedPlayer) {
    await updatedPlayer.checkGroupMemberships(em)
  }

  return {
    status: 200,
    body: {
      player: updatedPlayer
    }
  }
}

export const updateRoute = protectedRoute({
  method: 'patch',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      props: z.array(z.object({
        key: z.string(),
        value: z.string().nullable()
      }), { error: 'Props must be an array' }).optional()
    })
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'update player properties'),
    loadGame,
    loadPlayer
  ),
  handler: (ctx) => {
    const { props } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.authenticatedUser

    return updatePlayerHandler({
      em,
      player: ctx.state.player,
      props,
      user
    })
  }
})
