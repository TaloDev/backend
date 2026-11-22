import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerAliasSubscription from '../../../entities/player-alias-subscription.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import { withRedisLock } from '../../../lib/perf/redisLock.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
import { mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { patchDocs } from './docs.js'

export const patchRoute = apiRoute({
  method: 'patch',
  path: '/:id',
  docs: patchDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the subscription to update' }),
    }),
    body: z.object({
      props: updatePropsSchema.optional().meta({
        description:
          "An array of @type(Props:prop). Props that the subscription doesn't have will be added. Props with updated values will overwrite existing props. Props with a null value will be deleted",
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_PLAYER_RELATIONSHIPS]), loadAlias),
  handler: async (ctx) => {
    const em = ctx.em
    const { id } = ctx.state.validated.route
    const { props } = ctx.state.validated.body
    const currentAlias = ctx.state.alias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id,
      subscriber: currentAlias,
    })

    if (!subscription) {
      return ctx.throw(404, 'Subscription not found')
    }

    if (!props) {
      return {
        status: 200,
        body: { subscription },
      }
    }

    try {
      const updatedSubscription = await withRedisLock(
        { key: `locks:subscription-props:${subscription.id}` },
        () =>
          em.transactional(async (trx) => {
            const lockedSubscription = await trx.refreshOrFail(subscription)

            const { accepted: sizeAccepted, rejected: sizeRejected } = mergeAndSanitiseProps({
              prevProps: lockedSubscription.props.getItems(),
              newProps: props,
            })

            const { accepted, rejected: profanityRejected } = filterProfaneProps(
              sizeAccepted,
              ctx.state.game.blockPropsProfanity,
            )

            const allRejected = [...sizeRejected, ...profanityRejected]
            if (allRejected.length > 0) {
              throw new PropRejectionError(allRejected)
            }

            lockedSubscription.setProps(accepted)

            return lockedSubscription
          }),
      )

      return {
        status: 200,
        body: {
          subscription: updatedSubscription,
        },
      }
    } catch (err) {
      if (err instanceof PropRejectionError) {
        return buildErrorResponse({ props: [err.message] }, { rejectedProps: err.rejected })
      }
      throw err
    }
  },
})
