import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import GameFeedback from '../../../entities/game-feedback'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import { captureException } from '@sentry/node'
import { loadCategory } from './common'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { postDocs } from './docs'
import { createPropsSchema } from '../../../lib/validation/propsSchema'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'

export const postRoute = apiRoute({
  method: 'post',
  path: '/categories/:internalName',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    body: z.object({
      comment: z.string().min(1).max(5000),
      props: createPropsSchema.optional()
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_FEEDBACK]),
    loadAlias,
    loadCategory
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
        feedback
      }
    }
  }
})
