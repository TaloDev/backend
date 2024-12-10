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
      await redis.quit()

      let alias: PlayerAlias

      if (token === data.socketToken) {
        alias = await (RequestContext.getEntityManager()
          .getRepository(PlayerAlias)
          .findOne({
            id: data.playerAliasId,
            player: {
              game: conn.game
            }
          }, {
            populate: ['player.auth']
          }))

        if (alias.service === PlayerAliasService.TALO) {
          try {
            const valid = await validateSessionTokenJWT(
              data.sessionToken,
              alias,
              conn.getPlayerFromHeader(),
              conn.getAliasFromHeader()
            )
            if (!valid) {
              throw new Error()
            }
          } catch (err) {
            sendError(conn, req, new SocketError('INVALID_SESSION', 'Session token is invalid'))
            return
          }
        }
      } else {
        sendError(conn, req, new SocketError('INVALID_SOCKET_TOKEN', 'Invalid socket token'))
        return
      }

      conn.playerAlias = alias
      sendMessage(conn, 'v1.players.identify.success', alias)
    },
    {
      requirePlayer: false,
      apiKeyScopes: [APIKeyScope.READ_PLAYERS]
    }
  )
]

export default playerListeners
