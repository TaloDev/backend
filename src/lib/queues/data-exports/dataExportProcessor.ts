import { Collection, EntityManager, MikroORM } from '@mikro-orm/mysql'
import { SandboxedJob } from 'bullmq'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../../../entities/data-export'
import Event, { ClickHouseEventProp } from '../../../entities/event'
import ormConfig from '../../../config/mikro-orm.config'
import PlayerProp from '../../../entities/player-prop'
import Player from '../../../entities/player'
import Prop from '../../../entities/prop'
import PlayerAlias from '../../../entities/player-alias'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import GameStat from '../../../entities/game-stat'
import PlayerGameStat from '../../../entities/player-game-stat'
import GameActivity, { GameActivityType } from '../../../entities/game-activity'
import GameFeedback from '../../../entities/game-feedback'
import createClickHouseClient from '../../clickhouse/createClient'
import { ClickHouseEvent } from '../../../entities/event'
import { streamByCursor } from '../../perf/streamByCursor'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import path from 'path'
import { mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import { get } from 'lodash'
import { DataExportMailer } from './dataExportMailer'
import { format } from 'date-fns'
import { escapeCSVValue } from '../../lang/escapeCSVValue'

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
    const playerAliasCache = new Map<number, Partial<PlayerAlias>>()

    try {
      // step 1: fetch distinct prop keys for this game
      const keyQuery = `
        SELECT DISTINCT p.prop_key
        FROM event_props p
        INNER JOIN events e ON p.event_id = e.id
        WHERE e.game_id = ${dataExport.game.id}
        ${includeDevData ? '' : 'AND e.dev_build = false'}
      `

      const propKeys = await clickhouse.query({
        query: keyQuery,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHouseEventProp>())
        .then((rows) => rows.map((row) => row.prop_key))

      // step 2: dynamically build pivot select clause
      const pivotCols = propKeys.map((key) => `MAX(IF(p.prop_key = '${key}', p.prop_value, NULL)) AS "props.${key}"`).join(',\n  ')

      // step 3: build full pivot query
      const query = `
        SELECT
          e.id,
          e.name,
          e.game_id,
          e.player_alias_id,
          e.created_at,
          e.updated_at,
          ${pivotCols}
        FROM events e
        LEFT JOIN event_props p ON e.id = p.event_id
        WHERE e.game_id = ${dataExport.game.id}
        ${includeDevData ? '' : 'AND e.dev_build = false'}
        GROUP BY
          e.id, e.name, e.game_id, e.player_alias_id, e.created_at, e.updated_at
        ORDER BY e.created_at ASC
      `

      // step 4: stream the query
      const rows = await clickhouse.query({
        query,
        format: 'JSONEachRow'
      })

      const stream = rows.stream<ClickHouseEvent & Record<string, string>>()

      for await (const chunk of stream) {
        const rawEvents = chunk.map((row) => row.json())

        const aliasIds = [...new Set(rawEvents.map((e) => e.player_alias_id))]
        const unknownAliasIds = aliasIds.filter((id) => !playerAliasCache.has(id))

        // step 5: load aliases
        if (unknownAliasIds.length > 0) {
          /* @ts-expect-error types don't work nicely with partial loading */
          const aliasStream = streamByCursor<Partial<PlayerAlias>>(async (batchSize, after) => {
            return em.repo(PlayerAlias).findByCursor({
              id: { $in: unknownAliasIds }
            }, {
              first: batchSize,
              after,
              orderBy: { id: 'asc' },
              fields: ['service', 'identifier', 'player.id']
            })
          })

          for await (const alias of aliasStream) {
            /* @ts-expect-error primary keys are always loaded with partial loading */
            playerAliasCache.set(alias.id, alias)
          }
        }

        // step 6: hydrate events
        for (const data of rawEvents) {
          const playerAlias = playerAliasCache.get(data.player_alias_id as number)

          const event = new Event()
          event.construct(data.name as string, dataExport.game)
          event.id = data.id as string
          event.createdAt = new Date(data.created_at as string)
          event.updatedAt = new Date(data.updated_at as string)
          if (playerAlias) {
            event.playerAlias = playerAlias as PlayerAlias
          }

          // hydrate props from flattened keys
          const props: { key: string, value: string }[] = []
          for (const key of propKeys) {
            const value = data[`props.${key}`]
            if (value != null) {
              props.push({ key, value })
            }
          }
          event.props = props

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
    yield* streamByCursor<Player>(async (batchSize, after) => {
      const page = await em.repo(Player).findByCursor({
        game: dataExport.game,
        ...(includeDevData ? {} : { devBuild: false })
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' }
      })
      return page
    })
  }

  private async *streamPlayerAliases(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<PlayerAlias> {
    yield* streamByCursor<PlayerAlias>(async (batchSize, after) => {
      return em.repo(PlayerAlias).findByCursor({
        player: {
          game: dataExport.game,
          ...includeDevData ? {} : { devBuild: false }
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
    yield* streamByCursor<LeaderboardEntry>(async (batchSize, after) => {
      return em.repo(LeaderboardEntry).findByCursor({
        leaderboard: {
          game: dataExport.game
        },
        playerAlias: {
          player: {
            game: dataExport.game,
            ...(includeDevData ? {} : { devBuild: false })
          }
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['leaderboard'] as const
      })
    })
  }

  private async *streamGameStats(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<GameStat> {
    yield* streamByCursor<GameStat>(async (batchSize, after) => {
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
    yield* streamByCursor<PlayerGameStat>(async (batchSize, after) => {
      return em.repo(PlayerGameStat).findByCursor({
        stat: {
          game: dataExport.game
        },
        player: {
          game: dataExport.game,
          ...(includeDevData ? {} : { devBuild: false })
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['player'] as const
      })
    })
  }

  private async *streamGameActivities(
    dataExport: DataExport,
    em: EntityManager
  ): AsyncGenerator<GameActivity> {
    yield* streamByCursor<GameActivity>(async (batchSize, after) => {
      return em.repo(GameActivity).findByCursor({
        game: dataExport.game
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['user'] as const
      })
    })
  }

  private async *streamGameFeedback(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean
  ): AsyncGenerator<GameFeedback> {
    yield* streamByCursor<GameFeedback>(async (batchSize, after) => {
      return em.repo(GameFeedback).findByCursor({
        playerAlias: {
          player: {
            game: dataExport.game,
            ...(includeDevData ? {} : { devBuild: false })
          }
        }
      }, {
        first: batchSize,
        after,
        orderBy: { id: 'asc' },
        populate: ['playerAlias.player'] as const
      })
    })
  }

  private async streamCSVToArchive<T extends ExportableEntity>(
    archive: archiver.Archiver,
    filename: string,
    generatorFactory: (
      dataExport: DataExport,
      em: EntityManager,
      includeDevData: boolean
    ) => AsyncGenerator<T>,
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
    dynamicPropDiscovery: boolean = false,
    maxRowsPerFile: number = 100_000
  ): Promise<void> {
    const service = filename.replace('.csv', '') as DataExportAvailableEntities
    const baseColumns = this.getColumns(service)

    const createStreamPart = (partNum: number, finalColumns: string[]) => {
      const passThrough = new PassThrough()
      const partFilename = filename.replace('.csv', `-${partNum}.csv`)
      console.info(`Data export (${dataExport.id}) - building ${partFilename}`)

      archive.append(passThrough, { name: partFilename })
      passThrough.write(finalColumns.join(',') + '\n')
      return passThrough
    }

    if (!dynamicPropDiscovery) {
      const allPropKeys: Set<string> = new Set()
      const entitiesToProcess: T[] = []

      // first pass: collect all unique prop keys
      const firstPassGenerator = generatorFactory(dataExport, em, includeDevData)
      for await (const entity of firstPassGenerator) {
        if ('props' in entity) {
          this.getProps(entity as ExportableEntityWithProps).forEach((prop) =>
            allPropKeys.add(prop.key)
          )
        }
        entitiesToProcess.push(entity)
      }

      // construct columns
      const metaPropKeys = Array.from(allPropKeys)
        .filter((key) => key.startsWith('META_'))
        .sort()
      const otherPropKeys = Array.from(allPropKeys)
        .filter((key) => !key.startsWith('META_'))
        .sort()
      const finalColumns = [
        ...baseColumns.filter((col) => col !== 'props'),
        ...metaPropKeys.map((key) => `props.${key}`),
        ...otherPropKeys.map((key) => `props.${key}`)
      ]

      // chunked writing
      let partNum = 1
      let rowCount = 0
      let passThrough = createStreamPart(partNum, finalColumns)

      for (const entity of entitiesToProcess) {
        /* v8 ignore start */
        if (rowCount >= maxRowsPerFile) {
          passThrough.end()
          partNum++
          rowCount = 0
          passThrough = createStreamPart(partNum, finalColumns)
        }
        /* v8 ignore stop */

        const row = finalColumns.map((col) => this.transformColumn(col, entity)).join(',')
        passThrough.write(row + '\n')
        rowCount++
      }

      passThrough.end()
      return
    }

    // build props and buffer rows in one pass
    const allEntities: T[] = []
    const allPropKeys: Set<string> = new Set()

    const generator = generatorFactory(dataExport, em, includeDevData)
    for await (const entity of generator) {
      if ('props' in entity) {
        this.getProps(entity as ExportableEntityWithProps).forEach((prop) =>
          allPropKeys.add(prop.key)
        )
      }
      allEntities.push(entity)
    }

    // build final columns after seeing all props
    const metaPropKeys = Array.from(allPropKeys)
      .filter((key) => key.startsWith('META_'))
      .sort()
    const otherPropKeys = Array.from(allPropKeys)
      .filter((key) => !key.startsWith('META_'))
      .sort()
    const finalColumns = [
      ...baseColumns.filter((col) => col !== 'props'),
      ...metaPropKeys.map((key) => `props.${key}`),
      ...otherPropKeys.map((key) => `props.${key}`)
    ]

    // chunked writing
    let partNum = 1
    let rowCount = 0
    let passThrough = createStreamPart(partNum, finalColumns)

    for (const entity of allEntities) {
      /* v8 ignore start */
      if (rowCount >= maxRowsPerFile) {
        passThrough.end()
        partNum++
        rowCount = 0
        passThrough = createStreamPart(partNum, finalColumns)
      }
      /* v8 ignore stop */

      const row = finalColumns.map((col) => this.transformColumn(col, entity)).join(',')
      passThrough.write(row + '\n')
      rowCount++
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
      console.time(`Data export (${dataExport.id}) - events`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.EVENTS}.csv`,
        this.streamEvents,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - events`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYERS)) {
      console.time(`Data export (${dataExport.id}) - players`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYERS}.csv`,
        this.streamPlayers,
        dataExport,
        em,
        includeDevData,
        true
      )
      console.timeEnd(`Data export (${dataExport.id}) - players`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_ALIASES)) {
      console.time(`Data export (${dataExport.id}) - player aliases`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYER_ALIASES}.csv`,
        this.streamPlayerAliases,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - player aliases`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.LEADERBOARD_ENTRIES)) {
      console.time(`Data export (${dataExport.id}) - leaderboard entries`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.LEADERBOARD_ENTRIES}.csv`,
        this.streamLeaderboardEntries,
        dataExport,
        em,
        includeDevData,
        true
      )
      console.timeEnd(`Data export (${dataExport.id}) - leaderboard entries`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_STATS)) {
      console.time(`Data export (${dataExport.id}) - game stats`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_STATS}.csv`,
        this.streamGameStats,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - game stats`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYER_GAME_STATS)) {
      console.time(`Data export (${dataExport.id}) - player game stats`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYER_GAME_STATS}.csv`,
        this.streamPlayerGameStats,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - player game stats`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_ACTIVITIES)) {
      console.time(`Data export (${dataExport.id}) - game activities`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_ACTIVITIES}.csv`,
        this.streamGameActivities,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - game activities`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.GAME_FEEDBACK)) {
      console.time(`Data export (${dataExport.id}) - game feedback`)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.GAME_FEEDBACK}.csv`,
        this.streamGameFeedback,
        dataExport,
        em,
        includeDevData
      )
      console.timeEnd(`Data export (${dataExport.id}) - game feedback`)
    }

    console.info(`Data export (${dataExport.id}) - finalising`)
    console.time(`Data export (${dataExport.id}) - finalise`)
    await archive.finalize()
    console.timeEnd(`Data export (${dataExport.id}) - finalise`)

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
      return escapeCSVValue(value)
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
          return escapeCSVValue(String(value))
        }
      default:
        return escapeCSVValue(String(value))
    }
  }
}

export default async (job: SandboxedJob<DataExportJob>) => {
  const { dataExportId, includeDevData } = job.data
  console.time(`Data export (${dataExportId}) - end to end`)
  console.info(`Data export (${dataExportId}) - starting`)

  const orm = await MikroORM.init(ormConfig)
  const em = orm.em.fork()
  const dataExport = await em.repo(DataExport).findOneOrFail(dataExportId, { populate: ['game', 'createdByUser'] })

  dataExport.status = DataExportStatus.QUEUED
  await em.flush()
  console.info(`Data export (${dataExportId}) - queued`)

  const filename = `export-${dataExport.game.id}-${format(dataExport.createdAt, 'yyyyMMddHHssmm')}.zip`
  const filepath = './storage/' + filename

  const dataExporter = new DataExporter()
  await dataExporter.createZipStream(filepath, dataExport, em as EntityManager, includeDevData)

  dataExport.status = DataExportStatus.GENERATED
  await em.flush()
  console.info(`Data export (${dataExportId}) - generated`)

  const mailer = new DataExportMailer()
  await mailer.send(dataExport, filepath, filename)
  console.info(`Data export (${dataExportId}) - sending`)
}
