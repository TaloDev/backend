import { APIKeyScope } from '../../../entities/api-key.js'
import GameSave from '../../../entities/game-save.js'
import handleSQLError from '../../../lib/errors/handleSQLError.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema.js'
import { loadPlayer } from '../../../middleware/player-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { decodeContent } from './common.js'
import { postDocs } from './docs.js'

export const postRoute = apiRoute({
  method: 'post',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
    }),
    body: z.object({
      name: z.string().meta({ description: 'The name of the save' }),
      content: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .meta({ description: 'The @type(SaveContent:savecontent) of the save file' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.WRITE_GAME_SAVES]), loadPlayer),
  handler: async (ctx) => {
    const { name, content } = ctx.state.validated.body
    const em = ctx.em

    const save = new GameSave(name, ctx.state.player)
    save.content = decodeContent(content)

    try {
      await em.persist(save).flush()
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
