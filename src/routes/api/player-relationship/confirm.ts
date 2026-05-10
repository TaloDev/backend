import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAliasSubscription, {
  RelationshipType,
} from '../../../entities/player-alias-subscription.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { sendMessages } from '../../../socket/messages/socketMessage.js'
import { confirmDocs } from './docs.js'

export const confirmRoute = apiRoute({
  method: 'put',
  path: '/:id/confirm',
  docs: confirmDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      id: numericStringSchema.meta({
        description: 'The ID of the subscription request to confirm',
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS]), loadAlias),
  handler: async (ctx) => {
    const em = ctx.em
    const { id } = ctx.state.validated.route
    const currentAlias = ctx.state.alias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id,
      subscribedTo: currentAlias,
      confirmed: false,
    })

    if (!subscription) {
      return ctx.throw(404, 'Subscription request not found')
    }

    subscription.confirmed = true
    await em.flush()

    let reciprocalSubscription: PlayerAliasSubscription | null = null
    if (subscription.relationshipType === RelationshipType.BIDIRECTIONAL) {
      const existingReciprocal = await em.repo(PlayerAliasSubscription).findOne({
        subscriber: subscription.subscribedTo,
        subscribedTo: subscription.subscriber,
      })

      if (!existingReciprocal) {
        reciprocalSubscription = new PlayerAliasSubscription(
          subscription.subscribedTo,
          subscription.subscriber,
          RelationshipType.BIDIRECTIONAL,
        )
        reciprocalSubscription.confirmed = true
        await em.persist(reciprocalSubscription).flush()
      } else if (!existingReciprocal.confirmed) {
        existingReciprocal.confirmed = true
        reciprocalSubscription = existingReciprocal
        await em.flush()
      }
    }

    // only notify the original requester (subscriber) that their request was accepted
    // the person who accepted (subscribedTo) already knows they accepted it
    const subscriberConns = ctx.wss.findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        conn.playerAliasId === subscription.subscriber.id
      )
    })
    sendMessages(subscriberConns, 'v1.player-relationships.subscription-confirmed', {
      subscription,
    })

    return {
      status: 200,
      body: {
        subscription,
      },
    }
  },
})
