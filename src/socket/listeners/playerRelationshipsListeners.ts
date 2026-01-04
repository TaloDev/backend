import { z, ZodType } from 'zod'
import { SocketMessageListener } from '../router/createListener'
import createListener from '../router/createListener'
import { RequestContext } from '@mikro-orm/mysql'
import PlayerAliasSubscription from '../../entities/player-alias-subscription'
import { sendMessages } from '../messages/socketMessage'
import { APIKeyScope } from '../../entities/api-key'

const playerRelationshipsListeners = [
  createListener(
    'v1.player-relationships.broadcast',
    z.object({
      message: z.string()
    }),
    async ({ conn, data, socket }) => {
      const em = RequestContext.getEntityManager()!

      const subscriptions = await em.repo(PlayerAliasSubscription).find({
        subscribedTo: conn.playerAliasId,
        confirmed: true
      })

      const subscriberAliasIds = subscriptions.map((sub) => sub.subscriber.id)

      const conns = socket.findConnections((connection) => {
        return connection.hasScope(APIKeyScope.READ_PLAYER_BROADCASTS) &&
          !!connection.playerAliasId &&
          subscriberAliasIds.includes(connection.playerAliasId)
      })

      await sendMessages(conns, 'v1.player-relationships.broadcast', {
        message: data.message,
        playerAlias: await conn.getPlayerAlias()
      })
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_PLAYER_BROADCASTS]
    }
  )
] as unknown as SocketMessageListener<ZodType>[]

export default playerRelationshipsListeners
