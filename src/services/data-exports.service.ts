import { EntityManager, MikroORM } from '@mikro-orm/core'
import { HasPermission, Routes, Service, ServiceRequest, ServiceResponse, Validate } from 'koa-rest-services'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../entities/data-export'
import DataExportsPolicy from '../policies/data-exports.policy'
import Event from '../entities/event'
import AdmZip from 'adm-zip'
import get from 'lodash.get'
import Prop from '../entities/prop'
import Player from '../entities/player'
import PlayerAlias from '../entities/player-alias'
import Queue from 'bee-queue'
import createQueue from '../lib/queues/createQueue'
import ormConfig from '../config/mikro-orm.config'
import { EmailConfig } from '../lib/messaging/sendEmail'
import { unlink } from 'fs/promises'

interface EntityWithProps {
  props: Prop[]
  [key: string]: any
}

interface UpdatedDataExportStatus {
  id?: DataExportStatus
  failedAt?: Date
}

@Routes([
  {
    method: 'POST'
  },
  {
    method: 'GET',
    handler: 'index'
  },
  {
    method: 'GET',
    path: '/entities',
    handler: 'entities'
  }
])
export default class DataExportsService implements Service {
  queue: Queue
  emailQueue: Queue

  constructor() {
    this.queue = createQueue('data-export')

    this.queue.process(async (job: Queue.Job<any>) => {
      const { dataExportId } = job.data

      const orm = await MikroORM.init(ormConfig)
      const dataExport = await orm.em.getRepository(DataExport).findOne(dataExportId, ['game', 'createdByUser'])

      dataExport.status = DataExportStatus.QUEUED
      await orm.em.flush()

      const filename = `export-${dataExport.game.id}-${dataExport.createdAt.getTime()}.zip`
      const filepath = './storage/' + filename

      const zip: AdmZip = await this.createZip(dataExport, orm.em)
      zip.writeZip(filepath)

      dataExport.status = DataExportStatus.QUEUED
      await orm.em.flush()
      await orm.close()

      const emailJob = await this.emailQueue
        .createJob<EmailConfig>({
          to: dataExport.createdByUser.email,
          subject: 'Your Talo data export',
          templateId: 'data-export-ready',
          attachments: [
            {
              content: zip.toBuffer().toString('base64'),
              filename,
              type: 'application/zip',
              disposition: 'attachment',
              content_id: filename
            }
          ]
        })
        .save()

      await unlink(filepath)

      emailJob.on('succeeded', async () => {
        await this.updateDataExportStatus(dataExportId, { id: DataExportStatus.SENT })
      })

      emailJob.on('failed', async () => {
        await this.updateDataExportStatus(dataExportId, { failedAt: new Date() })
      })
    })

    this.queue.on('failed', async (job: Queue.Job<any>) => {
      const { dataExportId } = job.data
      await this.updateDataExportStatus(dataExportId, { failedAt: new Date() })
    })
  }

  private async updateDataExportStatus(dataExportId: number, newStatus: UpdatedDataExportStatus): Promise<void> {
    const orm = await MikroORM.init(ormConfig)

    const dataExport = await orm.em.getRepository(DataExport).findOne(dataExportId)
    if (newStatus.id) dataExport.status = newStatus.id
    if (newStatus.failedAt) dataExport.failedAt = newStatus.failedAt

    await orm.em.flush()
    await orm.close()
  }

  private async createZip(dataExport: DataExport, em: EntityManager): Promise<AdmZip> {
    const zip = new AdmZip()

    if (dataExport.entities.includes(DataExportAvailableEntities.EVENTS)) {
      const events = await em.getRepository(Event).find({ game: dataExport.game }, ['playerAlias'])
      zip.addFile('events.csv', this.buildCSV(DataExportAvailableEntities.EVENTS, events))
    }
    
    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYERS)) {
      const players = await em.getRepository(Player).find({ game: dataExport.game })
      zip.addFile('players.csv', this.buildCSV(DataExportAvailableEntities.PLAYERS, players))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_ALIASES)) {
      const aliases = await em.getRepository(PlayerAlias).find({
        player: { game: dataExport.game }
      })
      zip.addFile('player-aliases.csv', this.buildCSV(DataExportAvailableEntities.PLAYER_ALIASES, aliases))
    }

    return zip
  }

  private getColumns(service: DataExportAvailableEntities): string[] {
    switch (service) {
      case DataExportAvailableEntities.EVENTS:
        return ['id', 'name', 'playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id', 'createdAt', 'updatedAt', 'props']
      case DataExportAvailableEntities.PLAYERS:
        return ['id', 'lastSeenAt', 'createdAt', 'updatedAt', 'props']
      case DataExportAvailableEntities.PLAYER_ALIASES:
        return ['id', 'service', 'identifier', 'player.id', 'createdAt', 'updatedAt']
    }
  }

  private transformColumn(column: string, object: any): string {
    if (column.startsWith('props')) {
      return (object as EntityWithProps).props.find((prop) => column.endsWith(prop.key))?.value ?? ''
    }

    const value = get(object, column)

    switch (column) {
      case 'createdAt':
      case 'updatedAt':
      case 'lastSeenAt':
        return (value as Date).toISOString()
      default:
        return String(value)
    }
  }

  private buildPropColumns(columns: string[], objects: EntityWithProps[]): string[] {
    columns = columns.filter((col) => col !== 'props')

    const allProps = objects.reduce((acc: string[], curr: EntityWithProps): string[] => {
      return [...acc, ...curr.props.map((prop) => `props.${prop.key}`)]
    }, []).sort((a, b) => a.localeCompare(b))

    columns = [...new Set([...columns, ...allProps])]

    return columns
  }

  private buildCSV(service: DataExportAvailableEntities, objects: any[]): Buffer {
    let columns = this.getColumns(service)
    if (columns.includes('props')) columns = this.buildPropColumns(columns, objects)

    let content = columns.join(',') + '\n'

    for (const object of objects) {
      let entry = []

      for (const key of columns) {
        entry.push(this.transformColumn(key, object))
      }

      content += entry.join(',') + '\n'
    }

    return Buffer.from(content, 'utf8')
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(DataExportsPolicy, 'index')
  async index(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em
    const dataExports = await em.getRepository(DataExport).find({ game: Number(gameId) }, ['createdByUser'])

    return {
      status: 200,
      body: {
        dataExports
      }
    }
  }

  @Validate({
    body: {
      gameId: true,
      entities: async (val: string[]): Promise<boolean> => {
        return val?.length > 0
      }
    }
  })
  @HasPermission(DataExportsPolicy, 'post')
  async post(req: ServiceRequest): Promise<ServiceResponse> {
    if (!this.emailQueue) this.emailQueue = req.ctx.emailQueue
    
    const { entities } = req.body
    const em: EntityManager = req.ctx.em

    const dataExport = new DataExport(req.ctx.state.user, req.ctx.state.game)
    dataExport.entities = entities
    await em.persistAndFlush(dataExport)

    await this.queue.createJob({ dataExportId: dataExport.id }).save()

    return {
      status: 200,
      body: {
        dataExport
      }
    }
  }

  async entities(): Promise<ServiceResponse> {
    const entities = Object.keys(DataExportAvailableEntities).map((key) => DataExportAvailableEntities[key])

    return {
      status: 200,
      body: {
        entities
      }
    }
  }
}