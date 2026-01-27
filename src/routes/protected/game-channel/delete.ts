import { EntityManager } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import { userTypeGate } from '../../../middleware/policy-middleware'
import { UserType } from '../../../entities/user'
import GameChannel from '../../../entities/game-channel'
import User from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import Socket from '../../../socket'
import { loadChannel } from './common'

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
  user
}: DeleteChannelParams) {
  await channel.sendDeletedMessage(wss)

  if (!forwarded && user) {
    createGameActivity(em, {
      user,
      game: channel.game,
      type: GameActivityType.GAME_CHANNEL_DELETED,
      extra: {
        channelName: channel.name
      }
    })
  }

  await em.remove(channel).flush()

  return {
    status: 204
  }
}

export const deleteRoute = protectedRoute({
  method: 'delete',
  path: '/:id',
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'delete game channels'),
    loadGame,
    loadChannel
  ),
  handler: async (ctx) => {
    return deleteChannelHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      wss: ctx.wss,
      user: ctx.state.authenticatedUser
    })
  }
})
