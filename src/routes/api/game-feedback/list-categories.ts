import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { listCategoriesHandler } from '../../protected/game-feedback/list-categories'
import { listCategoriesDocs } from './docs'

export const listCategoriesRoute = apiRoute({
  method: 'get',
  path: '/categories',
  docs: listCategoriesDocs,
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_GAME_FEEDBACK])
  ),
  handler: (ctx) => {
    return listCategoriesHandler({ em: ctx.em, game: ctx.state.game })
  }
})
