import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadPlayer } from '../../../middleware/player-middleware'
import GameSave from '../../../entities/game-save'
import { listDocs } from './docs'
import { playerHeaderSchema } from '../../../lib/validation/playerHeaderSchema'

export const listRoute = apiRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-player': playerHeaderSchema
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_SAVES]),
    loadPlayer
  ),
  handler: async (ctx) => {
    const saves = await ctx.em.repo(GameSave).find({
      player: ctx.state.player
    })

    return {
      status: 200,
      body: {
        saves
      }
    }
  }
})
