import { Collection } from '@mikro-orm/core'
import ormConfig from '../../config/mikro-orm.config'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../../entities/data-export'
import PlayerProp from '../../entities/player-prop'
import Player from '../../entities/player'
import Prop from '../../entities/prop'
import PlayerAlias from '../../entities/player-alias'
import LeaderboardEntry from '../../entities/leaderboard-entry'
import GameStat from '../../entities/game-stat'
import PlayerGameStat from '../../entities/player-game-stat'
import GameActivity, { GameActivityType } from '../../entities/game-activity'
import GameFeedback from '../../entities/game-feedback'
import Event from '../../entities/event'
import createQueue from './createQueue'
import { Job, Queue } from 'bullmq'
import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import { mkdir, unlink } from 'fs/promises'
import path from 'path'
import createClickHouseClient from '../clickhouse/createClient'
import { ClickHouseEvent } from '../../entities/event'
import { streamCursor } from '../perf/streamByCursor'
import { devDataPlayerFilter } from '../../middleware/dev-data-middleware'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { get } from 'lodash'
import queueEmail from '../messaging/queueEmail'
import { createWriteStream, readFileSync } from 'fs'
import { EmailConfig } from '../../emails/mail'
import DataExportReady from '../../emails/data-export-ready-mail'

export type DataExportJob = {
  dataExportId: number
  includeDevData: boolean
}

type PropCollection = Collection<PlayerProp, Player>

type EntityWithProps = {
  props: Prop[] | PropCollection
}

type ExportableEntity = Event | Player | PlayerAlias | LeaderboardEntry | GameStat | PlayerGameStat | GameActivity | GameFeedback
type ExportableEntityWithProps = ExportableEntity & EntityWithProps

export class DataExporter {
  private async *streamEvents(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<Event> {
    const clickhouse = createClickHouseClient()

    const query = `
      SELECT *
      FROM events
      WHERE game_id = ${dataExport.game.id}
      ${includeDevData ? '' : 'AND dev_build = false'}
    `

    const rows = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    })
    const stream = rows.stream<ClickHouseEvent[]>()

    try {
      for await (const rows of stream) {
        for (const row of rows) {
          const event = await new Event().hydrate(em, row.json(), clickhouse, true)
          yield event
        }
      }
    } finally {
      await clickhouse.close()
    }
  }

  private async *streamPlayers(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<Player> {
    yield* streamCursor<Player>(async (batchSize, after) => {
      const page = await em.repo(Player).findByCursor({
        game: dataExport.game,
        ...(!includeDevData ? devDataPlayerFilter(em) : {})
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['props']
      })
      return page
    })
  }

  private async *streamPlayerAliases(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<PlayerAlias> {
    yield* streamCursor<PlayerAlias>(async (batchSize, after) => {
      return em.repo(PlayerAlias).findByCursor({
        player: {
          game: dataExport.game,
          ...(!includeDevData ? devDataPlayerFilter(em) : {})
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' }
      })
    })
  }

  private async *streamLeaderboardEntries(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<LeaderboardEntry> {
    yield* streamCursor<LeaderboardEntry>(async (batchSize, after) => {
      return em.repo(LeaderboardEntry).findByCursor({
        leaderboard: {
          game: dataExport.game
        },
        playerAlias: {
          player: {
            ...(!includeDevData ? devDataPlayerFilter(em) : {}),
            game: dataExport.game
          }
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        /* @ts-expect-error populate types don't work with findByCursor */
        populate: ['leaderboard']
      })
    })
  }

  private async *streamGameStats(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<GameStat> {
    yield* streamCursor<GameStat>(async (batchSize, after) => {
      const page = await em.repo(GameStat).findByCursor({
        game: dataExport.game
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' }
      })

      await Promise.all(page.items.map(async (stat) => {
        if (stat.global) {
          await stat.recalculateGlobalValue(includeDevData)
        }
      }))

      return page
    })
  }

  private async *streamPlayerGameStats(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<PlayerGameStat> {
    yield* streamCursor<PlayerGameStat>(async (batchSize, after) => {
      return em.repo(PlayerGameStat).findByCursor({
        stat: {
          game: dataExport.game
        },
        player: {
          ...(!includeDevData ? devDataPlayerFilter(em) : {}),
          game: dataExport.game
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        /* @ts-expect-error populate types don't work with findByCursor */
        populate: ['player']
      })
    })
  }

  private async *streamGameActivities(
    dataExport: DataExport,
    em: EntityManager
  ): AsyncGenerator<GameActivity> {
    yield* streamCursor<GameActivity>(async (batchSize, after) => {
      return em.repo(GameActivity).findByCursor({
        game: dataExport.game
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        /* @ts-expect-error populate types don't work with findByCursor */
        populate: ['user']
      })
    })
  }

  private async *streamGameFeedback(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<GameFeedback> {
    yield* streamCursor<GameFeedback>(async (batchSize, after) => {
      return em.repo(GameFeedback).findByCursor({
        playerAlias: {
          player: {
            ...(!includeDevData ? devDataPlayerFilter(em) : {}),
            game: dataExport.game
          }
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        /* @ts-expect-error populate types don't work with findByCursor */
        populate: ['playerAlias.player']
      })
    })
  }

  private async streamCSVToArchive<T extends ExportableEntity>(
    archive: archiver.Archiver,
    filename: string,
    generatorFactory: (dataExport: DataExport, em: EntityManager, includeDevData: boolean) => AsyncGenerator<T>,
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): Promise<void> {
    const passThrough = new PassThrough()
    archive.append(passThrough, { name: filename })

    const service = filename.replace('.csv', '') as DataExportAvailableEntities
    const baseColumns = this.getColumns(service)

    const allPropKeys: Set<string> = new Set()
    const entitiesToProcess: T[] = []

    // pass 1: collect all unique prop keys
    const firstPassGenerator = generatorFactory(dataExport, em, includeDevData)
    for await (const entity of firstPassGenerator) {
      if ('props' in entity) {
        this.getProps(entity as ExportableEntityWithProps).forEach((prop) => allPropKeys.add(prop.key))
      }
      entitiesToProcess.push(entity)
    }

    // construct prop columns
    const metaPropKeys = Array.from(allPropKeys).filter((key) => key.startsWith('META_')).sort()
    const otherPropKeys = Array.from(allPropKeys).filter((key) => !key.startsWith('META_')).sort()

    const finalColumns = [
      ...baseColumns.filter((col) => col !== 'props'),
      ...metaPropKeys.map((key) => `props.${key}`),
      ...otherPropKeys.map((key) => `props.${key}`)
    ]
    passThrough.write(finalColumns.join(',') + '\n')

    // pass 2: write all the rows
    for (const entity of entitiesToProcess) {
      const row = finalColumns.map((col) => this.transformColumn(col, entity)).join(',')
      passThrough.write(row + '\n')
    }

    passThrough.end()
  }

  public async createZipStream(filepath: string, dataExport: DataExport, em: EntityManager, includeDevData: boolean): Promise<void> {
    const dir = path.dirname(filepath)
    await mkdir(dir, { recursive: true })

    const output = createWriteStream(filepath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.pipe(output)
    archive.on('error', (err) => { throw err })
    output.on('error', (err) => { throw err })

    if (dataExport.entities.includes(DataExportAvailableEntities.EVENTS)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.EVENTS}.csv`,
        this.streamEvents,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYERS)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYERS}.csv`,
        this.streamPlayers,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_ALIASES)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYER_ALIASES}.csv`,
        this.streamPlayerAliases,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.LEADERBOARD_ENTRIES)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.LEADERBOARD_ENTRIES}.csv`,
        this.streamLeaderboardEntries,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_STATS)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_STATS}.csv`,
        this.streamGameStats,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_GAME_STATS)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYER_GAME_STATS}.csv`,
        this.streamPlayerGameStats,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_ACTIVITIES)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_ACTIVITIES}.csv`,
        this.streamGameActivities,
        dataExport,
        em,
        includeDevData
      )
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_FEEDBACK)) {
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_FEEDBACK}.csv`,
        this.streamGameFeedback,
        dataExport,
        em,
        includeDevData
      )
    }

    await archive.finalize()

    return new Promise((resolve, reject) => {
      output.on('close', resolve)
      output.on('error', reject)
      archive.on('error', reject)
    })
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
        return ['id', 'score', 'leaderboard.id', 'leaderboard.internalName', 'playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id', 'createdAt', 'updatedAt', 'props']
      case DataExportAvailableEntities.GAME_STATS:
        return ['id', 'internalName', 'name', 'defaultValue', 'minValue', 'maxValue', 'global', 'globalValue', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.PLAYER_GAME_STATS:
        return ['id', 'player.id', 'value', 'stat.id', 'stat.internalName', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.GAME_ACTIVITIES:
        return ['id', 'user.username', 'gameActivityType', 'gameActivityExtra', 'createdAt']
      case DataExportAvailableEntities.GAME_FEEDBACK:
        return ['id', 'category.internalName', 'comment', 'playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id', 'createdAt']
    }
  }

  private getProps(object: ExportableEntityWithProps): { key: string, value: string }[] {
    let props = object.props
    if (props instanceof Collection) props = props.getItems()
    return props.map(({ key, value }) => ({ key, value }))
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
        value = get(object, 'hydratedGlobalValue')
        return value ? String(value) : 'N/A'
      case 'playerAlias.id':
      case 'playerAlias.service':
      case 'playerAlias.identifier':
      case 'playerAlias.player.id':
        if (object instanceof GameFeedback && object.anonymised) {
          return 'Anonymous'
        } else {
          return String(value)
        }
      default:
        return String(value)
    }
  }
}

export function createDataExportQueue(emailQueue: Queue<EmailConfig>, onFailure: (job: Job<DataExportJob>) => Promise<void>) {
  return createQueue<DataExportJob>('data-export', async (job: Job<DataExportJob>) => {
    const { dataExportId, includeDevData } = job.data

    const orm = await MikroORM.init(ormConfig)
    const em = orm.em.fork()
    const dataExport = await em.repo(DataExport).findOneOrFail(dataExportId, { populate: ['game', 'createdByUser'] })

    dataExport.status = DataExportStatus.QUEUED
    await em.flush()

    const filename = `export-${dataExport.game.id}-${dataExport.createdAt.getTime()}.zip`
    const filepath = './storage/' + filename

    const dataExporter = new DataExporter()
    await dataExporter.createZipStream(filepath, dataExport, em as EntityManager, includeDevData)

    dataExport.status = DataExportStatus.GENERATED
    await em.flush()
    await orm.close()

    await queueEmail(emailQueue, new DataExportReady(dataExport.createdByUser.email, [
      {
        content: readFileSync(filepath).toString('base64'),
        filename,
        type: 'application/zip',
        disposition: 'attachment'
      }
    ]), { dataExportId })

    await unlink(filepath)
  /* v8 ignore start */
  }, {
    failed: async (job: Job<DataExportJob>) => {
      onFailure(job)
    }
  })
  /* v8 ignore stop */
}
