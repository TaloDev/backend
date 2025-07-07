import { MikroORM, EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Route, Validate, ValidationCondition } from 'koa-clay'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../entities/data-export'
import DataExportPolicy from '../policies/data-export.policy'
import ormConfig from '../config/mikro-orm.config'
import { GameActivityType } from '../entities/game-activity'
import createGameActivity from '../lib/logging/createGameActivity'
import { Job, Queue } from 'bullmq'
import createEmailQueue from '../lib/queues/createEmailQueue'
import { TraceService } from '../lib/tracing/trace-service'
import { EmailConfig } from '../emails/mail'
import { createDataExportQueue, DataExportJob } from '../lib/queues/createDataExportQueue'

type UpdatedDataExportStatus = {
  id?: DataExportStatus
  failedAt?: Date
}

@TraceService()
export default class DataExportService extends Service {
  queue: Queue<DataExportJob>
  emailQueue: Queue<EmailConfig>

  constructor() {
    super()

    this.emailQueue = createEmailQueue({
      completed: async (job: Job<EmailConfig>) => {
        await this.updateDataExportStatus(job.data.metadata!.dataExportId as number, { id: DataExportStatus.SENT })
      },
      failed: async (job: Job<EmailConfig>) => {
        await this.updateDataExportStatus(job.data.metadata!.dataExportId as number, { failedAt: new Date() })
      }
    }, 'data-export')

    this.queue = createDataExportQueue(this.emailQueue, async (job) => {
      /* v8 ignore next */
      await this.updateDataExportStatus(job.data.dataExportId, { failedAt: new Date() })
    })
  }

  private async updateDataExportStatus(dataExportId: number, newStatus: UpdatedDataExportStatus): Promise<void> {
    const orm = await MikroORM.init(ormConfig)
    const em = orm.em.fork()

    const dataExport = await em.getRepository(DataExport).findOneOrFail(dataExportId)
    if (newStatus.id) {
      dataExport.status = newStatus.id
    }
    if (newStatus.failedAt) {
      dataExport.failedAt = newStatus.failedAt
    }

    await em.flush()
    await orm.close()
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
