import { Collection, EntityManager, MikroORM } from '@mikro-orm/mysql'
import archiver from 'archiver'
import { SandboxedJob } from 'bullmq'
import { format } from 'date-fns'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { get } from 'lodash'
import assert from 'node:assert'
import path from 'path'
import { PassThrough } from 'stream'
import ormConfig from '../../../config/mikro-orm.config'
import DataExport, {
  DataExportAvailableEntities,
  DataExportStatus,
} from '../../../entities/data-export'
import Event, { ClickHouseEventProp } from '../../../entities/event'
import { ClickHouseEvent } from '../../../entities/event'
import GameActivity, { GameActivityType } from '../../../entities/game-activity'
import GameFeedback from '../../../entities/game-feedback'
import GameStat from '../../../entities/game-stat'
import LeaderboardEntry from '../../../entities/leaderboard-entry'
import Player from '../../../entities/player'
import PlayerAlias from '../../../entities/player-alias'
import PlayerGameStat from '../../../entities/player-game-stat'
import PlayerProp from '../../../entities/player-prop'
import Prop from '../../../entities/prop'
import createClickHouseClient from '../../clickhouse/createClient'
import { formatDateForClickHouse } from '../../clickhouse/formatDateTime'
import { escapeCSVValue } from '../../lang/escapeCSVValue'
import { DataExportJob } from './createDataExportQueue'
import { DataExportMailer } from './dataExportMailer'

type PropCollection = Collection<PlayerProp, Player>

type EntityWithProps = {
  props: Prop[] | PropCollection
}

type ExportableEntity =
  | Event
  | Player
  | PlayerAlias
  | LeaderboardEntry
  | GameStat
  | PlayerGameStat
  | GameActivity
  | GameFeedback
type ExportableEntityWithProps = ExportableEntity & EntityWithProps

export class DataExporter {
  static MAX_ALIAS_CACHE_SIZE = 100_000
  static EVENT_PAGE_SIZE = 10_000

  private async *streamEvents(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<Event> {
    const clickhouse = createClickHouseClient()
    const playerAliasCache = new Map<number, Partial<PlayerAlias>>()

    try {
      // step 1: paginate events using cursor-based pagination
      const PAGE_SIZE = DataExporter.EVENT_PAGE_SIZE
      let lastCreatedAt: Date | null = null
      let lastId: string | null = null

      while (true) {
        const cursorFilter: string =
          lastCreatedAt && lastId
            ? `AND (created_at, id) > (toDateTime64('${formatDateForClickHouse(lastCreatedAt)}', 3), '${lastId}')`
            : ''

        const rawEvents = await clickhouse
          .query({
            query: `
              SELECT id, name, game_id, player_alias_id, created_at, updated_at
              FROM events
              WHERE game_id = ${dataExport.game.id}
              ${includeDevData ? '' : 'AND dev_build = false'}
              ${cursorFilter}
              ORDER BY created_at ASC, id ASC
              LIMIT ${PAGE_SIZE}
            `,
            format: 'JSONEachRow',
          })
          .then((res) => res.json<ClickHouseEvent>())

        // step 3: fetch props for this page's events
        const rawProps =
          rawEvents.length > 0
            ? await clickhouse
                .query({
                  query: `
                  SELECT event_id, prop_key, prop_value
                  FROM event_props
                  WHERE game_id = ${dataExport.game.id}
                  ${includeDevData ? '' : 'AND dev_build = false'}
                  AND event_id IN (
                    SELECT id FROM events
                    WHERE game_id = ${dataExport.game.id}
                    ${includeDevData ? '' : 'AND dev_build = false'}
                    ${cursorFilter}
                    ORDER BY created_at ASC, id ASC
                    LIMIT ${PAGE_SIZE}
                  )
                `,
                  format: 'JSONEachRow',
                })
                .then((res) => res.json<ClickHouseEventProp>())
            : []

        const propsByEventId = new Map<string, Record<string, string>>()
        for (const prop of rawProps) {
          if (!propsByEventId.has(prop.event_id)) {
            propsByEventId.set(prop.event_id, {})
          }

          const eventProps = propsByEventId.get(prop.event_id)
          assert(eventProps)
          eventProps[prop.prop_key] = prop.prop_value
        }

        const aliasIds = [...new Set(rawEvents.map((e) => e.player_alias_id))]
        const unknownAliasIds = aliasIds.filter((id) => !playerAliasCache.has(id))

        // step 4: load aliases
        if (unknownAliasIds.length > 0) {
          const aliasStream = em.stream(PlayerAlias, {
            where: { id: { $in: unknownAliasIds } },
            orderBy: { id: 'asc' },
            fields: ['service', 'identifier', 'player:ref'],
          })

          for await (const alias of aliasStream) {
            playerAliasCache.set(alias.id, alias)
          }
        }

        // step 5: hydrate events
        for (const data of rawEvents) {
          const playerAlias = playerAliasCache.get(data.player_alias_id)

          const event = new Event()
          event.construct(data.name, dataExport.game)
          event.id = data.id
          event.createdAt = new Date(data.created_at)
          event.updatedAt = new Date(data.updated_at)
          if (playerAlias) {
            event.playerAlias = playerAlias as PlayerAlias
          }

          const eventProps = propsByEventId.get(data.id) ?? {}
          event.props = Object.entries(eventProps).map(([key, value]) => ({ key, value }))

          yield event
        }

        // evict oldest aliases after yielding all events on this page, ensuring
        // no alias needed for the current page's events is removed prematurely
        while (playerAliasCache.size > DataExporter.MAX_ALIAS_CACHE_SIZE) {
          playerAliasCache.delete(playerAliasCache.keys().next().value!)
        }

        if (rawEvents.length < PAGE_SIZE) {
          break
        }

        const last = rawEvents.at(-1)!
        lastCreatedAt = new Date(last.created_at)
        lastId = last.id
      }
    } finally {
      await clickhouse.close()
    }
  }

  private async *streamPlayers(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<Player> {
    yield* em.stream(Player, {
      where: {
        game: dataExport.game,
        ...(includeDevData ? {} : { devBuild: false }),
      },
      orderBy: { id: 'asc' },
    })
  }

  private async *streamPlayerAliases(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<PlayerAlias> {
    yield* em.stream(PlayerAlias, {
      where: {
        player: {
          game: dataExport.game,
          ...(includeDevData ? {} : { devBuild: false }),
        },
      },
      orderBy: { id: 'asc' },
    })
  }

  private async *streamLeaderboardEntries(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<LeaderboardEntry> {
    yield* em.stream(LeaderboardEntry, {
      where: {
        leaderboard: {
          game: dataExport.game,
        },
        playerAlias: {
          player: {
            game: dataExport.game,
            ...(includeDevData ? {} : { devBuild: false }),
          },
        },
      },
      orderBy: { id: 'asc' },
      populate: ['leaderboard'] as const,
    })
  }

  private async *streamGameStats(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<GameStat> {
    for await (const stat of em.stream(GameStat, {
      where: { game: dataExport.game },
      orderBy: { id: 'asc' },
    })) {
      // for data exports excluding dev data, recalculate global values without dev players
      if (!includeDevData && stat.global) {
        await stat.recalculateGlobalValue({ em, includeDevData: false })
      }
      yield stat
    }
  }

  private async *streamPlayerGameStats(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<PlayerGameStat> {
    yield* em.stream(PlayerGameStat, {
      where: {
        stat: {
          game: dataExport.game,
        },
        player: {
          game: dataExport.game,
          ...(includeDevData ? {} : { devBuild: false }),
        },
      },
      orderBy: { id: 'asc' },
      populate: ['player'] as const,
    })
  }

  private async *streamGameActivities(
    dataExport: DataExport,
    em: EntityManager,
  ): AsyncGenerator<GameActivity> {
    yield* em.stream(GameActivity, {
      where: { game: dataExport.game },
      orderBy: { id: 'asc' },
      populate: ['user'] as const,
    })
  }

  private async *streamGameFeedback(
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): AsyncGenerator<GameFeedback> {
    yield* em.stream(GameFeedback, {
      where: {
        playerAlias: {
          player: {
            game: dataExport.game,
            ...(includeDevData ? {} : { devBuild: false }),
          },
        },
      },
      orderBy: { id: 'asc' },
      populate: ['playerAlias.player'] as const,
    })
  }

  private async fetchEventPropKeys(
    dataExport: DataExport,
    includeDevData: boolean,
  ): Promise<string[]> {
    const clickhouse = createClickHouseClient()
    try {
      const rows = await clickhouse
        .query({
          query: `
            SELECT DISTINCT prop_key
            FROM event_props
            WHERE game_id = ${dataExport.game.id}
            ${includeDevData ? '' : 'AND dev_build = false'}
            ORDER BY prop_key ASC
          `,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ prop_key: string }>())
      return rows.map((r) => r.prop_key)
    } finally {
      await clickhouse.close()
    }
  }

  private async fetchPlayerPropKeys(
    dataExport: DataExport,
    includeDevData: boolean,
    em: EntityManager,
  ): Promise<string[]> {
    const rows = await em.getConnection().execute<{ key: string }[]>(
      `SELECT DISTINCT pp.key
       FROM player_prop AS pp
       INNER JOIN player AS p ON p.id = pp.player_id
       WHERE p.game_id = ?
       ${includeDevData ? '' : 'AND p.dev_build = 0'}
       ORDER BY pp.key ASC`,
      [dataExport.game.id],
    )
    return rows.map((r) => r.key)
  }

  private async fetchLeaderboardEntryPropKeys(
    dataExport: DataExport,
    includeDevData: boolean,
    em: EntityManager,
  ): Promise<string[]> {
    const rows = await em.getConnection().execute<{ key: string }[]>(
      `SELECT DISTINCT lep.key
       FROM leaderboard_entry_prop AS lep
       INNER JOIN leaderboard_entry AS le ON le.id = lep.leaderboard_entry_id
       INNER JOIN leaderboard AS lb ON lb.id = le.leaderboard_id
       INNER JOIN player_alias AS pa ON pa.id = le.player_alias_id
       INNER JOIN player AS p ON p.id = pa.player_id
       WHERE lb.game_id = ?
       ${includeDevData ? '' : 'AND p.dev_build = 0'}
       ORDER BY lep.key ASC`,
      [dataExport.game.id],
    )
    return rows.map((r) => r.key)
  }

  private async streamCSVToArchive<T extends ExportableEntity>(
    archive: archiver.Archiver,
    filename: string,
    generatorFactory: (
      dataExport: DataExport,
      em: EntityManager,
      includeDevData: boolean,
    ) => AsyncGenerator<T>,
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
    propKeys: string[] = [],
    maxRowsPerFile: number = 100_000,
  ): Promise<void> {
    const service = filename.replace('.csv', '') as DataExportAvailableEntities
    const baseColumns = this.getColumns(service)

    const metaPropKeys = propKeys.filter((k) => k.startsWith('META_'))
    const otherPropKeys = propKeys.filter((k) => !k.startsWith('META_'))
    const finalColumns = [
      ...baseColumns.filter((col) => col !== 'props'),
      ...metaPropKeys.map((key) => `props.${key}`),
      ...otherPropKeys.map((key) => `props.${key}`),
    ]

    const createStreamPart = (partNum: number) => {
      const passThrough = new PassThrough()
      const partFilename = filename.replace('.csv', `-${partNum}.csv`)
      console.info(`Data export (${dataExport.id}) - building ${partFilename}`)
      archive.append(passThrough, { name: partFilename })
      passThrough.write(finalColumns.join(',') + '\n')
      return passThrough
    }

    let partNum = 1
    let rowCount = 0
    let passThrough = createStreamPart(partNum)

    const generator = generatorFactory(dataExport, em, includeDevData)
    for await (const entity of generator) {
      /* v8 ignore start -- @preserve */
      if (rowCount >= maxRowsPerFile) {
        passThrough.end()
        partNum++
        rowCount = 0
        passThrough = createStreamPart(partNum)
      }
      /* v8 ignore stop -- @preserve */

      const row = finalColumns.map((col) => this.transformColumn(col, entity)).join(',')
      passThrough.write(row + '\n')
      rowCount++
    }

    passThrough.end()
  }

  public async createZipStream(
    filepath: string,
    dataExport: DataExport,
    em: EntityManager,
    includeDevData: boolean,
  ): Promise<void> {
    const dir = path.dirname(filepath)
    await mkdir(dir, { recursive: true })

    const output = createWriteStream(filepath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.pipe(output)
    archive.on('error', (err) => {
      throw err
    })
    output.on('error', (err) => {
      throw err
    })

    if (dataExport.entities.includes(DataExportAvailableEntities.EVENTS)) {
      console.time(`Data export (${dataExport.id}) - events`)
      const eventPropKeys = await this.fetchEventPropKeys(dataExport, includeDevData)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.EVENTS}.csv`,
        this.streamEvents,
        dataExport,
        em.fork(),
        includeDevData,
        eventPropKeys,
      )
      console.timeEnd(`Data export (${dataExport.id}) - events`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.PLAYERS)) {
      console.time(`Data export (${dataExport.id}) - players`)
      const playerPropKeys = await this.fetchPlayerPropKeys(dataExport, includeDevData, em)
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.PLAYERS}.csv`,
        this.streamPlayers,
        dataExport,
        em.fork(),
        includeDevData,
        playerPropKeys,
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
        em.fork(),
        includeDevData,
      )
      console.timeEnd(`Data export (${dataExport.id}) - player aliases`)
    }

    if (dataExport.entities.includes(DataExportAvailableEntities.LEADERBOARD_ENTRIES)) {
      console.time(`Data export (${dataExport.id}) - leaderboard entries`)
      const leaderboardPropKeys = await this.fetchLeaderboardEntryPropKeys(
        dataExport,
        includeDevData,
        em,
      )
      await this.streamCSVToArchive(
        archive,
        `${DataExportAvailableEntities.LEADERBOARD_ENTRIES}.csv`,
        this.streamLeaderboardEntries,
        dataExport,
        em.fork(),
        includeDevData,
        leaderboardPropKeys,
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
        em.fork(),
        includeDevData,
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
        em.fork(),
        includeDevData,
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
        em.fork(),
        includeDevData,
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
        em.fork(),
        includeDevData,
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
        return [
          'id',
          'name',
          'playerAlias.id',
          'playerAlias.service',
          'playerAlias.identifier',
          'playerAlias.player.id',
          'createdAt',
          'updatedAt',
          'props',
        ]
      case DataExportAvailableEntities.PLAYERS:
        return ['id', 'lastSeenAt', 'createdAt', 'updatedAt', 'props']
      case DataExportAvailableEntities.PLAYER_ALIASES:
        return ['id', 'service', 'identifier', 'player.id', 'createdAt', 'updatedAt']
      case DataExportAvailableEntities.LEADERBOARD_ENTRIES:
        return [
          'id',
          'score',
          'leaderboard.id',
          'leaderboard.internalName',
          'playerAlias.id',
          'playerAlias.service',
          'playerAlias.identifier',
          'playerAlias.player.id',
          'createdAt',
          'updatedAt',
          'props',
        ]
      case DataExportAvailableEntities.GAME_STATS:
        return [
          'id',
          'internalName',
          'name',
          'defaultValue',
          'minValue',
          'maxValue',
          'global',
          'globalValue',
          'createdAt',
          'updatedAt',
        ]
      case DataExportAvailableEntities.PLAYER_GAME_STATS:
        return [
          'id',
          'player.id',
          'value',
          'stat.id',
          'stat.internalName',
          'createdAt',
          'updatedAt',
        ]
      case DataExportAvailableEntities.GAME_ACTIVITIES:
        return ['id', 'user.username', 'gameActivityType', 'gameActivityExtra', 'createdAt']
      case DataExportAvailableEntities.GAME_FEEDBACK:
        return [
          'id',
          'category.internalName',
          'comment',
          'playerAlias.id',
          'playerAlias.service',
          'playerAlias.identifier',
          'playerAlias.player.id',
          'createdAt',
        ]
    }
  }

  private getProps(object: ExportableEntityWithProps): { key: string; value: string }[] {
    let props = object.props
    if (props instanceof Collection) props = props.getItems()
    return props.map(({ key, value }) => ({ key, value }))
  }

  private transformColumn(column: string, object: ExportableEntity): string {
    if (column.startsWith('props')) {
      const value =
        this.getProps(object as ExportableEntityWithProps).find((prop) => column.endsWith(prop.key))
          ?.value ?? ''
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
        return GameActivityType[value as number]
      case 'gameActivityExtra':
        value = get(object, 'extra')
        return `"${JSON.stringify(value).replace(/"/g, "'")}"`
      case 'globalValue':
        return (object as GameStat).global ? String(get(object, 'globalValue')) : 'N/A'
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
  const dataExport = await em
    .repo(DataExport)
    .findOneOrFail(dataExportId, { populate: ['game', 'createdByUser'] })

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
