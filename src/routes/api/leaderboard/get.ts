import { APIKeyScope } from '../../../entities/api-key'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { numericStringSchema } from '../../../lib/validation/numericStringSchema'
import { pageSchema } from '../../../lib/validation/pageSchema'
import { requireScopes } from '../../../middleware/policy-middleware'
import { listEntriesHandler } from '../../protected/leaderboard/entries'
import { loadLeaderboard } from './common'
import { getDocs } from './docs'

export const getRoute = apiRoute({
  method: 'get',
  path: '/:internalName/entries',
  docs: getDocs,
  schema: (z) => ({
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the leaderboard' }),
    }),
    query: z.object({
      page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
      aliasId: numericStringSchema
        .optional()
        .meta({ description: 'Only return entries for this alias ID' }),
      withDeleted: z
        .enum(['0', '1'])
        .optional()
        .transform((val) => val === '1')
        .meta({ description: 'Include entries that were deleted by a refresh interval' }),
      propKey: z
        .string()
        .optional()
        .meta({ description: 'Only return entries with this prop key' }),
      propValue: z
        .string()
        .optional()
        .meta({ description: 'Only return entries with a matching prop key and value' }),
      startDate: z
        .string()
        .optional()
        .meta({
          description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
        }),
      endDate: z
        .string()
        .optional()
        .meta({
          description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
        }),
      service: z
        .string()
        .optional()
        .meta({
          description:
            'Only return entries for this player alias service (e.g. steam, epic, username)',
        }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_LEADERBOARDS]), loadLeaderboard),
  handler: async (ctx) => {
    const { page, aliasId, withDeleted, propKey, propValue, startDate, endDate, service } =
      ctx.state.validated.query

    return listEntriesHandler({
      em: ctx.em,
      leaderboard: ctx.state.leaderboard,
      includeDevData: ctx.state.includeDevData,
      forwarded: true,
      page,
      aliasId,
      withDeleted,
      propKey,
      propValue,
      startDate,
      endDate,
      service,
    })
  },
})
