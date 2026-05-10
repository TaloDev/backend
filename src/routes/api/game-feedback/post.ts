import { captureException } from '@sentry/node'
import { APIKeyScope } from '../../../entities/api-key.js'
import GameFeedback from '../../../entities/game-feedback.js'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse.js'
import { PropSizeError } from '../../../lib/errors/propSizeError.js'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { createPropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadCategory } from './common.js'
import { postDocs } from './docs.js'

export const postRoute = apiRoute({
  method: 'post',
  path: '/categories/:internalName',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    body: z.object({
      comment: z.string().min(1).max(5000).meta({ description: 'The comment made by the player' }),
      props: createPropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_FEEDBACK]),
    loadAlias,
    loadCategory,
  ),
  handler: async (ctx) => {
    const { comment, props } = ctx.state.validated.body
    const em = ctx.em

    const category = ctx.state.category

    const feedback = new GameFeedback(category, ctx.state.alias)
    feedback.comment = comment
    feedback.anonymised = category.anonymised
    if (ctx.state.continuityDate) {
      feedback.createdAt = ctx.state.continuityDate
    }

    if (props) {
      try {
        feedback.setProps(hardSanitiseProps({ props }))
      } catch (err) {
        if (!(err instanceof PropSizeError)) {
          captureException(err)
        }
        return buildErrorResponse({ props: [(err as Error).message] })
      }
    }

    await em.persist(feedback).flush()

    return {
      status: 200,
      body: {
        feedback,
      },
    }
  },
})
