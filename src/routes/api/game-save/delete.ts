import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadPlayer } from '../../../middleware/player-middleware'
import { loadSave } from './common'
import { deleteDocs } from './docs'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const deleteRoute = apiRoute({
  method: 'delete',
  path: '/:id',
  docs: deleteDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema
    }),
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the save' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_SAVES]),
    loadPlayer,
    loadSave
  ),
  handler: async (ctx) => {
    const em = ctx.em
    const save = ctx.state.save

    await em.remove(save).flush()

    return {
      status: 204
    }
  }
})
