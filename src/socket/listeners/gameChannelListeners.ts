import { z, ZodType } from 'zod'
import { SocketMessageListener } from '../router/createListener'
import createListener from '../router/createListener'
import { RequestContext } from '@mikro-orm/mysql'
import GameChannel from '../../entities/game-channel'
import { sendMessages } from '../messages/socketMessage'
import { APIKeyScope } from '../../entities/api-key'

const gameChannelListeners = [
  createListener(
    'v1.channels.message',
    z.object({
      channel: z.object({
        id: z.number()
      }),
      message: z.string()
    }),
    async ({ conn, data, socket }) => {
      const em = RequestContext.getEntityManager()!
      const channel = await em
        .getRepository(GameChannel)
        .findOne({
          id: data.channel.id,
          game: conn.game
        }, {
          populate: ['members']
        })

      if (!channel) {
        throw new Error('Channel not found')
      }
      if (!channel.hasMember(conn.playerAliasId)) {
        throw new Error('Player not in channel')
      }

      const conns = socket.findConnections((conn) => {
        return conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) &&
          channel.hasMember(conn.playerAliasId)
      })
      await sendMessages(conns, 'v1.channels.message', {
        channel,
        message: data.message,
        playerAlias: await conn.getPlayerAlias()
      })

      channel.totalMessages++
      await em.flush()
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_GAME_CHANNELS]
    }
  )
] as unknown as SocketMessageListener<ZodType>[]

export default gameChannelListeners
