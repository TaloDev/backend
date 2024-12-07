import { z, ZodType } from 'zod'
import { SocketMessageListener } from '../router/socketRoutes'
import { createListener } from '../router/socketRouter'
import { RequestContext } from '@mikro-orm/core'
import GameChannel from '../../entities/game-channel'
import { sendMessages } from '../messages/socketMessage'
import { APIKeyScope } from '../../entities/api-key'

const gameChannelListeners: SocketMessageListener<ZodType>[] = [
  createListener(
    'v1.channels.message',
    z.object({
      channelName: z.string(),
      message: z.string()
    }),
    async ({ conn, data, socket }) => {
      const channel = await (RequestContext.getEntityManager()
        .getRepository(GameChannel)
        .findOne({
          name: data.channelName,
          game: conn.game
        }, {
          populate: ['members']
        }))

      if (!channel) return

      const conns = socket.findConnections((conn) => channel.members.getIdentifiers().includes(conn.playerAlias.id))
      sendMessages(conns, 'v1.channels.message', {
        channelName: channel.name,
        message: data.message
      })
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_GAME_CHANNELS]
    }
  )
]

export default gameChannelListeners
