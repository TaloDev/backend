import { EntityManager } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameChannel from '../../../entities/game-channel.js'
import { UserType } from '../../../entities/user.js'
import User from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'
import Socket from '../../../socket/index.js'
import { loadChannel } from './common.js'

type DeleteChannelParams = {
  em: EntityManager
  channel: GameChannel
  wss: Socket
  forwarded?: boolean
  user?: User
}

export async function deleteChannelHandler({
  em,
  channel,
  wss,
  forwarded,
  user,
}: DeleteChannelParams) {
  await channel.sendDeletedMessage(wss)

  if (!forwarded && user) {
    createGameActivity(em, {
      user,
      game: channel.game,
      type: GameActivityType.GAME_CHANNEL_DELETED,
      extra: {
        channelName: channel.name,
      },
    })
  }

  await em.remove(channel).flush()

  return {
    status: 204,
  }
}

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete game channels'),
    loadGame,
    loadChannel,
  ),
  handler: async (ctx) => {
    return deleteChannelHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      wss: ctx.wss,
      user: ctx.state.user,
    })
  },
})
