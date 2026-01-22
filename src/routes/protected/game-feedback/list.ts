import { QueryOrder } from '@mikro-orm/mysql'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import GameFeedback from '../../../entities/game-feedback'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'

const itemsPerPage = DEFAULT_PAGE_SIZE

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      page: z.coerce.number().catch(0),
      feedbackCategoryInternalName: z.string().optional(),
      search: z.string().optional()
    })
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { feedbackCategoryInternalName, search, page } = ctx.state.validated.query
    const em = ctx.em

    const query = em.qb(GameFeedback, 'gf')
      .select('gf.*')
      .orderBy({ createdAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(page * itemsPerPage)

    if (feedbackCategoryInternalName) {
      query.andWhere({
        category: {
          internalName: feedbackCategoryInternalName
        }
      })
    }

    if (search) {
      // prop:{key}={value}
      const propSearchMatch = search.trim().match(/^prop:([^=]+)=(.+)$/)

      if (propSearchMatch) {
        const [, key, value] = propSearchMatch
        query.andWhere({
          props: {
            $some: {
              key,
              value
            }
          }
        })
      } else {
        query.andWhere({
          $or: [
            { comment: { $like: `%${search}%` } },
            {
              $and: [
                { playerAlias: { identifier: { $like: `%${search}%` } } },
                { anonymised: false }
              ]
            },
            {
              props: {
                $some: {
                  $or: [
                    { key: { $like: `%${search}%` } },
                    { value: { $like: `%${search}%` } }
                  ]
                }
              }
            }
          ]
        })
      }
    }

    if (!ctx.state.includeDevData) {
      query.andWhere({
        playerAlias: {
          player: {
            devBuild: false
          }
        }
      })
    }

    const [feedback, count] = await query
      .andWhere({
        category: {
          game: ctx.state.game
        }
      })
      .getResultAndCount()

    await em.populate(feedback, ['playerAlias'])

    return {
      status: 200,
      body: {
        feedback,
        count,
        itemsPerPage
      }
    }
  }
})
