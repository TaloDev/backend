import { setTraceAttributes } from '@hyperdx/node-opentelemetry'
import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import { z, ZodType } from 'zod'
import { APIKeyScope } from '../../entities/api-key'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import { validateSessionTokenJWT } from '../../middleware/player-auth-middleware'
import SocketError, { sendError } from '../messages/socketError'
import { sendMessage } from '../messages/socketMessage'
import createListener from '../router/createListener'
import { SocketMessageListener } from '../router/createListener'

const playerListeners = [
  createListener(
    'v1.players.identify',
    z.object({
      playerAliasId: z.number(),
      socketToken: z.string(),
      sessionToken: z.string().optional(),
    }),
    async ({ conn, req, data, socket }) => {
      const token = await socket.redis.get(`socketTokens.${data.playerAliasId}`)

      let alias: PlayerAlias
      const em = RequestContext.getEntityManager() as EntityManager

      if (token === data.socketToken) {
        alias = await em.repo(PlayerAlias).findOneOrFail(
          {
            id: data.playerAliasId,
            player: {
              game: conn.gameId,
            },
          },
          {
            populate: ['player.auth'],
          },
        )

        if (alias.service === PlayerAliasService.TALO) {
          const valid = await validateSessionTokenJWT(
            em,
            data.sessionToken ?? '',
            alias,
            alias.player.id,
            alias.id,
          )
          if (!valid) {
            await sendError({
              conn,
              req,
              error: new SocketError('INVALID_SESSION_TOKEN', 'Invalid session token'),
            })
            return
          }
        }
      } else {
        await sendError({
          conn,
          req,
          error: new SocketError('INVALID_SOCKET_TOKEN', 'Invalid socket token'),
        })
        return
      }

      setTraceAttributes({
        'socket.connection.game_id': alias.player.game.id,
        'socket.connection.player_id': alias.player.id,
        'socket.connection.alias_id': alias.id,
        'socket.connection.dev_build': conn.isDevBuild(),
      })

      conn.playerAliasId = alias.id
      await sendMessage(conn, 'v1.players.identify.success', alias)

      await alias.player.handleSession(em, true)
      await alias.player.setPresence(em, socket, alias, true)
    },
    {
      requirePlayer: false,
      apiKeyScopes: [APIKeyScope.READ_PLAYERS],
    },
  ),
] as unknown as SocketMessageListener<ZodType>[]

export default playerListeners
