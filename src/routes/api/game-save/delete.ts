import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema.js'
import { loadPlayer } from '../../../middleware/player-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadSave } from './common.js'
import { deleteDocs } from './docs.js'

export const deleteRoute = apiRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
    }),
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the save' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_GAME_SAVES]), loadPlayer, loadSave),
  handler: async (ctx) => {
    const em = ctx.em
    const save = ctx.state.save

    await em.remove(save).flush()

    return {
      status: 204,
    }
  },
})
