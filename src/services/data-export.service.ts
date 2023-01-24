import { Collection, FilterQuery, MikroORM } from '@mikro-orm/core'
import { HasPermission, Routes, Service, Request, Response, Validate, ValidationCondition } from 'koa-clay'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../entities/data-export'
import DataExportPolicy from '../policies/data-export.policy'
import Event from '../entities/event'
import AdmZip from 'adm-zip'
import get from 'lodash.get'
import Prop from '../entities/prop'
import Player from '../entities/player'
import PlayerAlias from '../entities/player-alias'
import createQueue from '../lib/queues/createQueue'
import ormConfig from '../config/mikro-orm.config'
import { unlink } from 'fs/promises'
import LeaderboardEntry from '../entities/leaderboard-entry'
import PlayerGameStat from '../entities/player-game-stat'
import GameStat from '../entities/game-stat'
import GameActivity, { GameActivityType } from '../entities/game-activity'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import DataExportReady from '../emails/data-export-ready-mail'
import createGameActivity from '../lib/logging/createGameActivity'
import handlePricingPlanAction from '../lib/billing/handlePricingPlanAction'
import { PricingPlanActionType } from '../entities/pricing-plan-action'
import queueEmail from '../lib/messaging/queueEmail'
import OrganisationPricingPlanAction from '../entities/organisation-pricing-plan-action'
import { EntityManager } from '@mikro-orm/mysql'
import pick from 'lodash.pick'
import PlayerProp from '../entities/player-prop'
import { Job, Queue } from 'bullmq'
import createEmailQueue from '../lib/queues/createEmailQueue'
import { EmailConfig } from '../lib/messaging/sendEmail'

type PropCollection = Collection<PlayerProp, Player>

interface EntityWithProps {
  props: Prop[] | PropCollection
}

interface UpdatedDataExportStatus {
  id?: DataExportStatus
  failedAt?: Date
}

interface DataExportJob {
  dataExportId: number,
  includeDevData: boolean
}

type ExportableEntity = Event | Player | PlayerAlias | LeaderboardEntry | GameStat | PlayerGameStat | GameActivity
type ExportableEntityWithProps = ExportableEntity & EntityWithProps

@Routes([
  {
    method: 'POST'
  },
  {
    method: 'GET'
  },
  {
    method: 'GET',
    path: '/entities',
    handler: 'entities'
  }
])
export default class DataExportService extends Service {
  queue: Queue
  emailQueue: Queue

  constructor() {
    super()

    this.emailQueue = createEmailQueue({
      completed: async (job: Job<EmailConfig>) => {
        await this.updateDataExportStatus(job.data.metadata.dataExportId as number, { id: DataExportStatus.SENT })
      },
      failed: async (job: Job<EmailConfig>) => {
        await this.updateDataExportStatus(job.data.metadata.dataExportId as number, { failedAt: new Date() })
      }
    })

    this.queue = createQueue<DataExportJob>('data-export', async (job: Job<DataExportJob>) => {
      const { dataExportId, includeDevData } = job.data

      const orm = await MikroORM.init(ormConfig)
      const em = orm.em.fork()
      const dataExport = await em.getRepository(DataExport).findOne(dataExportId, { populate: ['game', 'createdByUser'] })

      dataExport.status = DataExportStatus.QUEUED
      await em.flush()

      const filename = `export-${dataExport.game.id}-${dataExport.createdAt.getTime()}.zip`
      const filepath = './storage/' + filename

      const zip: AdmZip = await this.createZip(dataExport, em as EntityManager, includeDevData)
      zip.writeZip(filepath)

      dataExport.status = DataExportStatus.QUEUED
      await em.flush()
      await orm.close()

      await queueEmail(this.emailQueue, new DataExportReady(dataExport.createdByUser.email, [
        {
          content: zip.toBuffer().toString('base64'),
          filename,
          type: 'application/zip',
          disposition: 'attachment',
          content_id: filename
        }
      ]), { dataExportId })

      await unlink(filepath)
    /* c8 ignore start */
    }, {
      failed: async (job: Job<DataExportJob>) => {
        await this.updateDataExportStatus(job.data.dataExportId, { failedAt: new Date() })
      }
    })
    /* c8 ignore stop */
  }

  private async updateDataExportStatus(dataExportId: number, newStatus: UpdatedDataExportStatus): Promise<void> {
    const orm = await MikroORM.init(ormConfig)
    const em = orm.em.fork()

    const dataExport = await em.getRepository(DataExport).findOne(dataExportId)
    if (newStatus.id) dataExport.status = newStatus.id
    if (newStatus.failedAt) {
      dataExport.failedAt = newStatus.failedAt

      const orgPlanAction = await em.getRepository(OrganisationPricingPlanAction).findOne({ type: PricingPlanActionType.DATA_EXPORT, extra: { dataExportId } })
      if (orgPlanAction) {
        await em.getRepository(OrganisationPricingPlanAction).removeAndFlush(orgPlanAction)
      }
    }

    await em.flush()
    await orm.close()
  }

  private async getEvents(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<Event[]> {
    const where: FilterQuery<Event> = { game: dataExport.game }

    if (!includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter(em)
      }
    }

    return await em.getRepository(Event).find(where, { populate: ['playerAlias'] })
  }

  private async getPlayers(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<Player[]> {
    let where: FilterQuery<Player> = { game: dataExport.game }

    if (!includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    return await em.getRepository(Player).find(where)
  }

  private async getPlayerAliases(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<PlayerAlias[]> {
    const where: FilterQuery<PlayerAlias> = {
      player: { game: dataExport.game }
    }

    if (!includeDevData) {
      where.player = Object.assign(where.player, devDataPlayerFilter(em))
    }

    return await em.getRepository(PlayerAlias).find(where)
  }

  private async getLeaderboardEntries(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<LeaderboardEntry[]> {
    const where: FilterQuery<LeaderboardEntry> = {
      leaderboard: { game: dataExport.game }
    }

    if (!includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter(em)
      }
    }

    return await em.getRepository(LeaderboardEntry).find(where, {
      populate: ['leaderboard']
    })
  }

  private async getGameStats(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<GameStat[]> {
    const stats = await em.getRepository(GameStat).find({ game: dataExport.game })

    for (const stat of stats) {
      /* c8 ignore next 3 */
      if (stat.global) {
        await stat.recalculateGlobalValue(includeDevData)
      }
    }

    return stats
  }

  private async getPlayerGameStats(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<PlayerGameStat[]> {
    const where: FilterQuery<PlayerGameStat> = {
      stat: {
        game: dataExport.game
      }
    }

    if (!includeDevData) {
      where.player = devDataPlayerFilter(em)
    }

    return await em.getRepository(PlayerGameStat).find(where)
  }

  private async getGameActivities(dataExport: DataExport, em: EntityManager): Promise<GameActivity[]> {
    return await em.getRepository(GameActivity).find({
      game: dataExport.game
    }, {
      populate: ['user']
    })
  }

  private async createZip(dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<AdmZip> {
    const zip = new AdmZip()

    if (dataExport.entities.includes(DataExportAvailableEntities.EVENTS)) {
      const items = await this.getEvents(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.EVENTS}.csv`, this.buildCSV(DataExportAvailableEntities.EVENTS, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYERS)) {
      const items = await this.getPlayers(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.PLAYERS}.csv`, this.buildCSV(DataExportAvailableEntities.PLAYERS, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_ALIASES)) {
      const items = await this.getPlayerAliases(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.PLAYER_ALIASES}.csv`, this.buildCSV(DataExportAvailableEntities.PLAYER_ALIASES, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.LEADERBOARD_ENTRIES)) {
      const items = await this.getLeaderboardEntries(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.LEADERBOARD_ENTRIES}.csv`, this.buildCSV(DataExportAvailableEntities.LEADERBOARD_ENTRIES, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_STATS)) {
      const items = await this.getGameStats(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.GAME_STATS}.csv`, this.buildCSV(DataExportAvailableEntities.GAME_STATS, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_GAME_STATS)) {
      const items = await this.getPlayerGameStats(dataExport, em, includeDevData)
      zip.addFile(`${DataExportAvailableEntities.PLAYER_GAME_STATS}.csv`, this.buildCSV(DataExportAvailableEntities.PLAYER_GAME_STATS, items))
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_ACTIVITIES)) {
      const items = await this.getGameActivities(dataExport, em)
      zip.addFile(`${DataExportAvailableEntities.GAME_ACTIVITIES}.csv`, this.buildCSV(DataExportAvailableEntities.GAME_ACTIVITIES, items))
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
      case DataExportAvailableEntities.LEADERBOARD_ENTRIES:
        return ['id', 'score', 'leaderboard.id', 'leaderboard.internalName', 'playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.GAME_STATS:
        return ['id', 'internalName', 'name', 'defaultValue', 'minValue', 'maxValue', 'global', 'globalValue', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.PLAYER_GAME_STATS:
        return ['id', 'value', 'stat.id', 'stat.internalName', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.GAME_ACTIVITIES:
        return ['id', 'user.username', 'gameActivityType', 'gameActivityExtra', 'createdAt']
    }
  }

  private getProps(object: ExportableEntityWithProps): { key: string, value: string }[] {
    let props = object.props
    if (props instanceof Collection) props = props.getItems()
    return props.map((prop) => pick(prop, ['key', 'value']))
  }

  private transformColumn(column: string, object: ExportableEntity): string {
    if (column.startsWith('props')) {
      const value = this.getProps(object as ExportableEntityWithProps).find((prop) => column.endsWith(prop.key))?.value ?? ''
      return value
    }

    let value = get(object, column)

    switch (column) {
      case 'createdAt':
      case 'updatedAt':
      case 'lastSeenAt':
        return (value as Date).toISOString()
      case 'gameActivityType':
        value = get(object, 'type')
        return GameActivityType[(value as number)]
      case 'gameActivityExtra':
        value = get(object, 'extra')
        return `"${JSON.stringify(value).replace(/"/g, '\'')}"`
      case 'globalValue':
        return get(object, 'hydratedGlobalValue') ?? 'N/A'
      default:
        return String(value)
    }
  }

  private buildPropColumns(columns: string[], objects: EntityWithProps[]): string[] {
    columns = columns.filter((col) => col !== 'props')

    const allProps = objects.reduce((acc: string[], curr: EntityWithProps): string[] => {
      return [...acc, ...this.getProps(curr as ExportableEntityWithProps).map((prop) => `props.${prop.key}`)]
    }, []).sort((a, b) => a.localeCompare(b))

    columns = [...new Set([...columns, ...allProps])]

    return columns
  }

  private buildCSV(service: DataExportAvailableEntities, objects: ExportableEntity[]): Buffer {
    let columns = this.getColumns(service)
    if (columns.includes('props')) columns = this.buildPropColumns(columns, (objects as ExportableEntityWithProps[]))

    let content = columns.join(',') + '\n'

    for (const object of objects) {
      const entry = []

      for (const key of columns) {
        entry.push(this.transformColumn(key, object))
      }

      content += entry.join(',') + '\n'
    }

    return Buffer.from(content, 'utf8')
  }

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

    const orgPlanAction = await handlePricingPlanAction(req, PricingPlanActionType.DATA_EXPORT)

    const dataExport = new DataExport(req.ctx.state.user, req.ctx.state.game)
    dataExport.entities = entities
    await em.persistAndFlush(dataExport)

    if (orgPlanAction) {
      orgPlanAction.extra.dataExportId = dataExport.id
    }

    await createGameActivity(em, {
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

  async entities(): Promise<Response> {
    const entities = Object.keys(DataExportAvailableEntities).map((key) => DataExportAvailableEntities[key])

    return {
      status: 200,
      body: {
        entities
      }
    }
  }
}
