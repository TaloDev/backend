import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { updatePlayerHandler } from '../../protected/player/update.js'
import { loadPlayer } from './common.js'
import { patchDocs } from './docs.js'

export const patchRoute = apiRoute({
  method: 'patch',
  path: '/:id',
  docs: patchDocs,
  schema: (z) => ({
    body: z.object({
      props: updatePropsSchema.optional().meta({
        description:
          "An array of @type(Props:prop). Props that the player doesn't have will be added. Props with updated values will overwrite existing props. Props with a null value will be deleted from the player",
      }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_PLAYERS]), loadPlayer),
  handler: (ctx) => {
    const { props } = ctx.state.validated.body

    return updatePlayerHandler({
      em: ctx.em,
      player: ctx.state.player,
      props,
      forwarded: true,
    })
  },
})
