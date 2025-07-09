import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate, ValidationCondition } from 'koa-clay'
import DataExport, { DataExportAvailableEntities } from '../entities/data-export'
import DataExportPolicy from '../policies/data-export.policy'
import { GameActivityType } from '../entities/game-activity'
import createGameActivity from '../lib/logging/createGameActivity'
import { Queue } from 'bullmq'
import { TraceService } from '../lib/tracing/trace-service'
import { createDataExportQueue } from '../lib/queues/data-exports/createDataExportQueue'
import { DataExportJob } from '../lib/queues/data-exports/dataExportProcessor'

@TraceService()
export default class DataExportService extends Service {
  queue: Queue<DataExportJob>

  constructor() {
    super()
    this.queue = createDataExportQueue()
  }

  @Route({
    method: 'GET'
  })
  @HasPermission(DataExportPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const dataExports = await em.getRepository(DataExport).find({
      game: req.ctx.state.game
    }, {
      populate: ['createdByUser']
    })

    return {
      status: 200,
      body: {
        dataExports
      }
    }
  }

  @Route({
    method: 'POST'
  })
  @Validate({
    body: {
      entities: {
        required: true,
        validation: async (val: unknown): Promise<ValidationCondition[]> => [
          {
            check: Array.isArray(val) && val.length > 0,
            error: 'Entities must be an array',
            break: true
          },
          {
            check: (val as string[]).every((entity) => typeof entity === 'string'),
            error: 'Entities must be an array of strings'
          }
        ]
      }
    }
  })
  @HasPermission(DataExportPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { entities } = req.body
    const em: EntityManager = req.ctx.em

    const dataExport = new DataExport(req.ctx.state.user, req.ctx.state.game)
    dataExport.entities = entities
    await em.persistAndFlush(dataExport)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.DATA_EXPORT_REQUESTED,
      extra: {
        dataExportId: dataExport.id,
        display: {
          'Entities': entities.join(', ')
        }
      }
    })

    await em.flush()

    await this.queue.add('data-export', {
      dataExportId: dataExport.id,
      includeDevData: req.ctx.state.includeDevData
    })

    return {
      status: 200,
      body: {
        dataExport
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/entities'
  })
  async entities(): Promise<Response> {
    const entities = Object.keys(DataExportAvailableEntities).map((key) => DataExportAvailableEntities[key as keyof typeof DataExportAvailableEntities])

    return {
      status: 200,
      body: {
        entities
      }
    }
  }
}
