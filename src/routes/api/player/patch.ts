import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { updatePlayerHandler } from '../../protected/player/update'
import { loadPlayer } from './common'
import { updatePropsSchema } from '../../../lib/validation/propsSchema'
import { patchDocs } from './docs'

export const patchRoute = apiRoute({
  method: 'patch',
  path: '/:id',
  docs: patchDocs,
  schema: (z) => ({
    body: z.object({
      props: updatePropsSchema.optional().meta({
        description: 'An array of @type(Props:prop). Props that the player doesn\'t have will be added. Props with updated values will overwrite existing props. Props with a null value will be deleted from the player'
      })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_PLAYERS]),
    loadPlayer
  ),
  handler: (ctx) => {
    const { props } = ctx.state.validated.body

    return updatePlayerHandler({
      em: ctx.em,
      player: ctx.state.player,
      props,
      forwarded: true
    })
  }
})
