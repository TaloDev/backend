import { captureException } from '@sentry/node'
import { APIKeyScope } from '../../../entities/api-key'
import GameFeedback from '../../../entities/game-feedback'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { createPropsSchema } from '../../../lib/validation/propsSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadCategory } from './common'
import { postDocs } from './docs'

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
