import { z, ZodType } from 'zod'
import { createListener } from '../router/socketRouter'
import { sendMessage } from '../messages/socketMessage'
import Redis from 'ioredis'
import redisConfig from '../../config/redis.config'
import { RequestContext } from '@mikro-orm/core'
import PlayerAlias from '../../entities/player-alias'
import { SocketMessageListener } from '../router/socketRoutes'
import SocketError, { sendError } from '../messages/socketError'

const playerListeners: SocketMessageListener<ZodType>[] = [
  createListener(
    'v1.players.identify',
    z.object({
      playerAliasId: z.number(),
      token: z.string()
    }),
    async ({ conn, req, data }) => {
      const redis = new Redis(redisConfig)
      const token = await redis.get(`socketTokens.${data.playerAliasId}`)

      if (token === data.token) {
        conn.playerAlias = await (RequestContext.getEntityManager())
          .getRepository(PlayerAlias)
          .findOne({
            id: data.playerAliasId,
            player: {
              game: conn.game
            }
          })

        sendMessage(conn, 'v1.players.identify.success', conn.playerAlias)
      } else {
        sendError(conn, req, new SocketError('INVALID_SOCKET_TOKEN', 'Invalid socket token'))
      }

      await redis.quit()
    },
    false
  )
]

export default playerListeners
