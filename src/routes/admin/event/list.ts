import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { decodeEventCursor, readEventPage } from '../../../lib/events/readEvents.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { listEventsQuerySchema } from './common.js'
import { listDocs } from './docs.js'

export const listEventsAdminRoute = adminRoute({
  method: 'get',
  docs: listDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-include-dev-data': z
        .string()
        .optional()
        .meta({ description: 'Set to 1 to include dev build events' }),
    }),
    query: listEventsQuerySchema,
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.READ_EVENTS])),
  handler: async (ctx) => {
    const { from, to, limit, includeProps, cursor } = ctx.state.validated.query

    const decodedCursor = cursor ? decodeEventCursor(cursor) : null
    if (cursor && !decodedCursor) {
      return ctx.throw(400, 'Invalid cursor, use the nextCursor from a previous page')
    }

    const page = await readEventPage({
      clickhouse: ctx.clickhouse,
      gameId: ctx.state.game.id,
      from: new Date(from),
      to: new Date(to),
      includeDevData: ctx.state.includeDevData,
      includeProps: !!Number(includeProps),
      limit,
      cursor: decodedCursor,
    })

    return {
      status: 200,
      body: page,
    }
  },
})
