import { APIKeyScope } from '../../../entities/api-key.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { listCategoriesHandler } from '../../protected/game-feedback/list-categories.js'
import { listCategoriesDocs } from './docs.js'

export const listCategoriesRoute = apiRoute({
  method: 'get',
  path: '/categories',
  docs: listCategoriesDocs,
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_FEEDBACK])),
  handler: (ctx) => {
    return listCategoriesHandler({ em: ctx.em, game: ctx.state.game })
  },
})
