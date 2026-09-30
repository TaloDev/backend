import { EntityManager } from '@mikro-orm/mysql'
import type { RejectedProp } from '../../../lib/props/sanitiseProps.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import Player from '../../../entities/player.js'
import User, { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { withRedisLock } from '../../../lib/perf/redisLock.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
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
  const { updatedPlayer, rejectedProps } = await withRedisLock(
    { key: `locks:player-props:${player.id}` },
    () =>
      em.transactional(async (trx) => {
        const lockedPlayer = await trx.refreshOrFail(player)

        let rejectedProps: RejectedProp[] = []

        if (props) {
          const metaRejected: RejectedProp[] = !forwarded
            ? props
                .filter((prop) => isReservedPropKey(prop.key))
                .map((prop) => ({
                  key: prop.key,
                  error: 'PROP_KEY_RESERVED',
                  message: RESERVED_PROP_KEY_MESSAGE,
                }))
            : []

          const { accepted: sizeAccepted, rejected: sizeRejected } = mergeAndSanitiseProps({
            prevProps: lockedPlayer.props.getItems(),
            newProps: props,
            extraFilter: (prop) => !isReservedPropKey(prop.key),
          })

          if (lockedPlayer.game.blockPropsProfanity) {
            const { accepted, rejected: profanityRejected } = filterProfaneProps(sizeAccepted, true)
            lockedPlayer.setProps(accepted)
            rejectedProps = [...metaRejected, ...sizeRejected, ...profanityRejected]
          } else {
            lockedPlayer.setProps(sizeAccepted)
            rejectedProps = [...metaRejected, ...sizeRejected]
          }

          if (!forwarded && user) {
            createGameActivity(trx, {
              actor: user,
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
          updatedPlayer: lockedPlayer,
          rejectedProps,
        }
      }),
  )

  await updatedPlayer.checkGroupMemberships(em)

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
