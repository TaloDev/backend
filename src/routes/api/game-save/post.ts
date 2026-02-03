import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadPlayer } from '../../../middleware/player-middleware'
import GameSave from '../../../entities/game-save'
import handleSQLError from '../../../lib/errors/handleSQLError'
import { decodeContent } from './common'
import { postDocs } from './docs'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'

export const postRoute = apiRoute({
  method: 'post',
  docs: postDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema
    }),
    body: z.object({
      name: z.string().meta({ description: 'The name of the save' }),
      content: z.union([z.string(), z.record(z.string(), z.unknown())]).meta({ description: 'The @type(SaveContent:savecontent) of the save file' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_SAVES]),
    loadPlayer
  ),
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
        save
      }
    }
  }
})
