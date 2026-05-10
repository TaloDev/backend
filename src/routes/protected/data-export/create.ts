import type { Queue } from 'bullmq'
import DataExport, { DataExportAvailableEntities } from '../../../entities/data-export.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import {
  createDataExportQueue,
  DataExportJob,
} from '../../../lib/queues/data-exports/createDataExportQueue.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate, requireEmailConfirmed } from '../../../middleware/policy-middleware.js'

let dataExportQueue: Queue<DataExportJob> | null = null

function getDataExportQueue() {
  if (!dataExportQueue) {
    dataExportQueue = createDataExportQueue()
  }
  return dataExportQueue
}

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      entities: z.array(z.enum(DataExportAvailableEntities)).nonempty(),
    }),
  }),
  middleware: withMiddleware(
    userTypeGate([UserType.ADMIN], 'create data exports'),
    requireEmailConfirmed('create data exports'),
    loadGame,
  ),
  handler: async (ctx) => {
    const { entities } = ctx.state.validated.body
    const em = ctx.em

    const dataExport = new DataExport(ctx.state.user, ctx.state.game)
    dataExport.entities = entities
    await em.persist(dataExport).flush()

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.DATA_EXPORT_REQUESTED,
      extra: {
        dataExportId: dataExport.id,
        display: {
          Entities: entities.join(', '),
        },
      },
    })

    await em.flush()

    await getDataExportQueue().add('data-export', {
      dataExportId: dataExport.id,
      includeDevData: ctx.state.includeDevData,
    })

    return {
      status: 200,
      body: {
        dataExport,
      },
    }
  },
})
