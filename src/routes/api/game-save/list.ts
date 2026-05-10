import { APIKeyScope } from '../../../entities/api-key.js'
import GameSave from '../../../entities/game-save.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema.js'
import { loadPlayer } from '../../../middleware/player-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { listDocs } from './docs.js'

export const listRoute = apiRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema,
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_SAVES]), loadPlayer),
  handler: async (ctx) => {
    const saves = await ctx.em.repo(GameSave).find({
      player: ctx.state.player,
    })

    return {
      status: 200,
      body: {
        saves,
      },
    }
  },
})
