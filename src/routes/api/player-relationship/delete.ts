import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import PlayerAliasSubscription, { RelationshipType } from '../../../entities/player-alias-subscription'
import { sendMessages } from '../../../socket/messages/socketMessage'
import { deleteDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const deleteRoute = apiRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    route: z.object({
      id: z.string().meta({ description: 'The ID of the subscription to delete' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS]),
    loadAlias
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const { id } = ctx.state.validated.route
    const currentAlias = ctx.state.alias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id: Number(id),
      subscriber: currentAlias
    })

    if (!subscription) {
      return ctx.throw(404, 'Subscription not found')
    }

    const subscribedToId = subscription.subscribedTo.id
    const subscriberId = subscription.subscriber.id
    const isBidirectional = subscription.relationshipType === RelationshipType.BIDIRECTIONAL

    const reciprocalSubscription = isBidirectional ? await em.repo(PlayerAliasSubscription).findOne({
      subscriber: subscription.subscribedTo,
      subscribedTo: subscription.subscriber
    }) : null

    em.remove(subscription)
    if (reciprocalSubscription) {
      em.remove(reciprocalSubscription)
    }
    await em.flush()

    // notify both parties with a single message containing both subscriptions
    const conns = ctx.wss.findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        (conn.playerAliasId === subscribedToId || conn.playerAliasId === subscriberId)
      )
    })
    await sendMessages(conns, 'v1.player-relationships.subscription-deleted', {
      subscription,
      reciprocalSubscription: reciprocalSubscription
    })

    return {
      status: 204
    }
  }
})
