import { z, ZodType } from 'zod'
import { SocketMessageListener } from '../router/createListener'
import createListener from '../router/createListener'
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

      if (!channel) {
        throw new Error('Channel not found')
      }
      if (!channel.members.getIdentifiers().includes(conn.playerAlias.id)) {
        throw new Error('Player not in channel')
      }

      const conns = socket.findConnections((conn) => {
        return conn.scopes.includes(APIKeyScope.READ_GAME_CHANNELS) &&
          channel.members.getIdentifiers().includes(conn.playerAlias.id)
      })
      sendMessages(conns, 'v1.channels.message', {
        channelName: channel.name,
        message: data.message,
        fromPlayerAlias: conn.playerAlias
      })

      channel.totalMessages++
      await RequestContext.getEntityManager().flush()
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_GAME_CHANNELS]
    }
  )
]

export default gameChannelListeners
