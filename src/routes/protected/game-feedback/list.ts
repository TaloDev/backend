import { QueryOrder } from '@mikro-orm/mysql'
import GameFeedback from '../../../entities/game-feedback'
import { DEFAULT_PAGE_SIZE } from '../../../lib/pagination/itemsPerPage'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { loadGame } from '../../../middleware/game-middleware'

const itemsPerPage = DEFAULT_PAGE_SIZE

export const listRoute = protectedRoute({
  method: 'get',
  schema: (z) => ({
    query: z.object({
      page: pageSchema,
      feedbackCategoryInternalName: z.string().optional(),
      search: z.string().optional(),
      withDeleted: z
        .enum(['0', '1'])
        .optional()
        .transform((v) => v === '1'),
    }),
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { feedbackCategoryInternalName, search, page, withDeleted } = ctx.state.validated.query
    const em = ctx.em

    const query = em
      .qb(GameFeedback, 'gf')
      .select('gf.*')
      .andWhere(withDeleted ? {} : { deletedAt: null })
      .orderBy({ createdAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(page * itemsPerPage)

    if (feedbackCategoryInternalName) {
      query.andWhere({
        category: {
          internalName: feedbackCategoryInternalName,
        },
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
              value,
            },
          },
        })
      } else {
        query.andWhere({
          $or: [
            { comment: { $like: `%${search}%` } },
            {
              $and: [
                { playerAlias: { identifier: { $like: `%${search}%` } } },
                { anonymised: false },
              ],
            },
            {
              props: {
                $some: {
                  $or: [{ key: { $like: `%${search}%` } }, { value: { $like: `%${search}%` } }],
                },
              },
            },
          ],
        })
      }
    }

    if (!ctx.state.includeDevData) {
      query.andWhere({
        playerAlias: {
          player: {
            devBuild: false,
          },
        },
      })
    }

    const [feedback, count] = await query
      .andWhere({
        category: {
          game: ctx.state.game,
        },
      })
      .getResultAndCount()

    await em.populate(feedback, ['playerAlias'])

    return {
      status: 200,
      body: {
        feedback,
        count,
        itemsPerPage,
      },
    }
  },
})
