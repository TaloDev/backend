import { z, ZodType } from 'zod'
import { createListener } from '../router/socketRouter'
import { sendMessage } from '../socketMessage'
import Redis from 'ioredis'
import redisConfig from '../../config/redis.config'
import { RequestContext } from '@mikro-orm/core'
import PlayerAlias from '../../entities/player-alias'
import { SocketMessageListener } from '../router/socketRoutes'

const playerListeners: SocketMessageListener<ZodType>[] = [
  createListener(
    'v1.players.identify',
    z.object({
      playerAliasId: z.number(),
      token: z.string()
    }),
    async (conn, data) => {
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
        sendMessage(conn, 'v1.players.identify.error', {
          reason: 'Invalid token'
        })
      }

      await redis.quit()
    },
    false
  )
]

export default playerListeners
