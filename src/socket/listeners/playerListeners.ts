import { z, ZodType } from 'zod'
import createListener from '../router/createListener'
import { sendMessage } from '../messages/socketMessage'
import Redis from 'ioredis'
import redisConfig from '../../config/redis.config'
import { RequestContext } from '@mikro-orm/core'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import { SocketMessageListener } from '../router/createListener'
import SocketError, { sendError } from '../messages/socketError'
import { APIKeyScope } from '../../entities/api-key'
import { validateSessionTokenJWT } from '../../middlewares/player-auth-middleware'

const playerListeners: SocketMessageListener<ZodType>[] = [
  createListener(
    'v1.players.identify',
    z.object({
      playerAliasId: z.number(),
      socketToken: z.string(),
      sessionToken: z.string().optional()
    }),
    async ({ conn, req, data }) => {
      const redis = new Redis(redisConfig)
      const token = await redis.get(`socketTokens.${data.playerAliasId}`)

      if (token === data.socketToken) {
        conn.playerAlias = await (RequestContext.getEntityManager()
          .getRepository(PlayerAlias)
          .findOne({
            id: data.playerAliasId,
            player: {
              game: conn.game
            }
          }, {
            populate: ['player.auth']
          }))

        if (conn.playerAlias.service === PlayerAliasService.TALO) {
          try {
            if (!await validateSessionTokenJWT(data.sessionToken, conn.playerAlias)) {
              throw new Error()
            }
            sendMessage(conn, 'v1.players.identify.success', conn.playerAlias)
          } catch (err) {
            sendError(conn, req, new SocketError('INVALID_SESSION', 'Session token is invalid'))
          }
        } else {
          sendMessage(conn, 'v1.players.identify.success', conn.playerAlias)
        }
      } else {
        sendError(conn, req, new SocketError('INVALID_SOCKET_TOKEN', 'Invalid socket token'))
      }

      await redis.quit()
    },
    {
      requirePlayer: false,
      apiKeyScopes: [APIKeyScope.READ_PLAYERS]
    }
  )
]

export default playerListeners
