import { APIKeyScope } from '../../../entities/api-key.js'
import handleSQLError from '../../../lib/errors/handleSQLError.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema.js'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema.js'
import { loadPlayer } from '../../../middleware/player-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { decodeContent, loadSave } from './common.js'
import { patchDocs } from './docs.js'

export const patchRoute = apiRoute({
  method: 'patch',
  path: '/:id',
  docs: patchDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
    }),
    route: z.object({
      id: numericStringSchema.meta({ description: 'The ID of the save' }),
    }),
    body: z.object({
      name: z.string().optional().meta({ description: 'A new name for the save' }),
      content: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .meta({ description: 'The new @type(SaveContent:savecontent) for the save' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_GAME_SAVES]), loadPlayer, loadSave),
  handler: async (ctx) => {
    const { name, content } = ctx.state.validated.body
    const em = ctx.em

    const save = ctx.state.save
    if (name) save.name = name
    save.content = decodeContent(content)

    try {
      await em.flush()
    } catch (err) {
      return handleSQLError(err as Error)
    }

    return {
      status: 200,
      body: {
        save,
      },
    }
  },
})
