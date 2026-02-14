import { FilterQuery } from '@mikro-orm/mysql'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import PlayerAliasSubscription from '../../../entities/player-alias-subscription'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { getSubscriptionsDocs } from './docs'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { relationshipTypeSchema } from './common'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'

export const getSubscriptionsRoute = apiRoute({
  method: 'get',
  path: '/subscriptions',
  docs: getSubscriptionsDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema
    }),
    query: z.object({
      confirmed: z.enum(['true', 'false']).optional().meta({ description: 'Filter by confirmation status ("true" or "false")' }),
      aliasId: numericStringSchema.optional().meta({ description: 'Filter by a specific subscribed-to alias ID' }),
      relationshipType: relationshipTypeSchema.optional().meta({ description: 'Filter by relationship type ("unidirectional" or "bidirectional")' }),
      page: pageSchema.meta({ description: 'Page number for pagination (default: 0)' })
    })
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYER_RELATIONSHIPS]),
    loadAlias
  ),
  handler: async (ctx) => {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const em = ctx.em
    const currentAlias = ctx.state.alias
    const { confirmed, aliasId, relationshipType, page } = ctx.state.validated.query

    const cacheKey = `${PlayerAliasSubscription.getSubscriptionsCacheKey(currentAlias)}-${confirmed}-${aliasId}-${relationshipType}-${page}`

    return withResponseCache({ key: cacheKey }, async () => {
      const where: FilterQuery<PlayerAliasSubscription> = {
        subscriber: currentAlias
      }

      if (confirmed !== undefined) {
        where.confirmed = confirmed === 'true'
      }

      if (aliasId) {
        where.subscribedTo = aliasId
      }

      if (relationshipType) {
        where.relationshipType = relationshipType
      }

      const [subscriptions, count] = await em.repo(PlayerAliasSubscription).findAndCount(where, {
        limit: itemsPerPage + 1,
        offset: page * itemsPerPage
      })

      return {
        status: 200,
        body: {
          subscriptions: subscriptions.slice(0, itemsPerPage),
          count,
          itemsPerPage,
          isLastPage: subscriptions.length <= itemsPerPage
        }
      }
    })
  }
})
