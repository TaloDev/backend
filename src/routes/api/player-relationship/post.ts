import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAliasSubscription from '../../../entities/player-alias-subscription.js'
import PlayerAlias from '../../../entities/player-alias.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { createPropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { sendMessages } from '../../../socket/messages/socketMessage.js'
import { relationshipTypeSchema } from './common.js'
import { postDocs } from './docs.js'

export const postRoute = apiRoute({
  method: 'post',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    body: z.object({
      aliasId: z.number().int().meta({ description: 'The ID of the player alias to subscribe to' }),
      relationshipType: relationshipTypeSchema.meta({
        description: 'The type of relationship: "unidirectional" or "bidirectional"',
      }),
      props: createPropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS]), loadAlias),
  handler: async (ctx) => {
    const em = ctx.em
    const { aliasId, relationshipType, props = [] } = ctx.state.validated.body
    const currentAlias = ctx.state.alias

    const subscribedTo = await em.repo(PlayerAlias).findOne({
      id: aliasId,
      player: {
        game: ctx.state.game,
      },
    })

    if (!subscribedTo) {
      return ctx.throw(404, 'Player alias for subscription not found')
    }

    if (currentAlias.id === subscribedTo.id) {
      return ctx.throw(400, 'Cannot subscribe to yourself')
    }

    const existing = await em.repo(PlayerAliasSubscription).findOne({
      subscriber: currentAlias,
      subscribedTo,
    })

    if (existing) {
      return ctx.throw(400, 'Subscription already exists')
    }

    const { accepted: sizeAccepted, rejected: sizeRejected } = hardSanitiseProps({ props })

    const { accepted, rejected: profanityRejected } = filterProfaneProps(
      sizeAccepted,
      ctx.state.game.blockPropsProfanity,
    )
    const rejectedProps = [...sizeRejected, ...profanityRejected]

    if (rejectedProps.length > 0) {
      const err = new PropRejectionError(rejectedProps)
      return buildErrorResponse({ props: [err.message] }, { rejectedProps: err.rejected })
    }

    const subscription = new PlayerAliasSubscription(currentAlias, subscribedTo, relationshipType)
    subscription.setProps(accepted)
    await em.persist(subscription).flush()

    const conns = ctx.wss.findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        conn.playerAliasId === subscribedTo.id
      )
    })
    sendMessages(conns, 'v1.player-relationships.subscription-created', {
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
