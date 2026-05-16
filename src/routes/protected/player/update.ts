import { EntityManager, LockMode } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity.js'
import Player from '../../../entities/player.js'
import User, { UserType } from '../../../entities/user.js'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse.js'
import { PropSizeError } from '../../../lib/errors/propSizeError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { filterProfaneProps, type RejectedProp } from '../../../lib/props/filterProfaneProps.js'
import { sanitiseProps, mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import { loadPlayer } from './common.js'

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
  user,
}: UpdatePlayerParams) {
  const {
    player: updatedPlayer,
    errorMessage,
    rejectedProps,
  } = await em.transactional(async (trx) => {
    const lockedPlayer = await trx.refreshOrFail(player, { lockMode: LockMode.PESSIMISTIC_WRITE })

    let rejectedProps: RejectedProp[] = []

    if (props) {
      if (!forwarded && props.some((prop) => prop.key.startsWith('META_'))) {
        return {
          player: null,
          errorMessage:
            "Prop keys starting with 'META_' are reserved for internal systems, please use another key name",
          rejectedProps: [],
        }
      }

      try {
        const mergedProps = mergeAndSanitiseProps({
          prevProps: lockedPlayer.props.getItems(),
          newProps: props,
          extraFilter: (prop) => !prop.key.startsWith('META_'),
        })

        if (forwarded && lockedPlayer.game.blockPropsProfanity) {
          const { accepted, rejected } = filterProfaneProps(mergedProps, true)
          lockedPlayer.setProps(accepted)
          rejectedProps = rejected
        } else {
          lockedPlayer.setProps(mergedProps)
        }
      } catch (err) {
        if (err instanceof PropSizeError) {
          return {
            player: null,
            errorMessage: err.message,
            rejectedProps: [],
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
              Player: player.id,
              'Updated props': sanitiseProps({ props })
                .map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`)
                .join(', '),
            },
          },
        })
      }
    }

    return {
      player: lockedPlayer,
      errorMessage: null,
      rejectedProps,
    }
  })

  if (errorMessage) {
    return buildErrorResponse({
      props: [errorMessage],
    })
  }

  if (updatedPlayer) {
    await updatedPlayer.checkGroupMemberships(em)
  }

  return {
    status: 200,
    body: {
      player: updatedPlayer,
      rejectedProps,
    },
  }
}

export const updateRoute = protectedRoute({
  method: 'patch',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      props: updatePropsSchema.optional(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN, UserType.DEV], 'update player properties'),
    loadGame,
    loadPlayer,
  ),
  handler: (ctx) => {
    const { props } = ctx.state.validated.body
    const em = ctx.em
    const user = ctx.state.user

    return updatePlayerHandler({
      em,
      player: ctx.state.player,
      props,
      user,
    })
  },
})
