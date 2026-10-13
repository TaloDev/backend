import { FilterQuery, RequestContext } from '@mikro-orm/mysql'
import { z, ZodType } from 'zod'
import { APIKeyScope } from '../../entities/api-key.js'
import PlayerAliasSubscription from '../../entities/player-alias-subscription.js'
import { sendMessages } from '../messages/socketMessage.js'
import { SocketMessageListener } from '../router/createListener.js'
import createListener from '../router/createListener.js'

export const MAX_BROADCAST_ALIAS_IDS = 1000

const playerRelationshipsListeners = [
  createListener(
    'v1.player-relationships.broadcast',
    z.object({
      message: z.string(),
      aliasIds: z.array(z.number().int().positive()).max(MAX_BROADCAST_ALIAS_IDS).nullish(),
    }),
    async ({ conn, data, socket }) => {
      const em = RequestContext.getEntityManager()!

      const where: FilterQuery<PlayerAliasSubscription> = {
        subscribedTo: conn.playerAliasId,
        confirmed: true,
      }

      // a missing or empty list means send to every confirmed subscriber
      if (data.aliasIds?.length) {
        where.subscriber = { id: { $in: data.aliasIds } }
      }

      const subscriptions = await em.repo(PlayerAliasSubscription).find(where)

      const subscriberAliasIds = new Set(subscriptions.map((sub) => sub.subscriber.id))

      const conns = socket.findConnections((connection) => {
        return (
          connection.hasScope(APIKeyScope.READ_PLAYER_BROADCASTS) &&
          !!connection.playerAliasId &&
          subscriberAliasIds.has(connection.playerAliasId)
        )
      })

      sendMessages(conns, 'v1.player-relationships.broadcast', {
        message: data.message,
        playerAlias: await conn.getPlayerAlias(),
      })
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_PLAYER_BROADCASTS],
    },
  ),
] as unknown as SocketMessageListener<ZodType>[]

export default playerRelationshipsListeners
