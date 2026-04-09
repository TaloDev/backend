import { Collection } from '@mikro-orm/mysql'
import { parse } from 'csv-parse'
import { readFile, rm, mkdir } from 'fs/promises'
import assert from 'node:assert'
import * as os from 'os'
import path from 'path'
import * as unzipper from 'unzipper'
import { DataExportAvailableEntities } from '../../../../src/entities/data-export'
import { GameActivityType } from '../../../../src/entities/game-activity'
import LeaderboardEntry from '../../../../src/entities/leaderboard-entry'
import LeaderboardEntryProp from '../../../../src/entities/leaderboard-entry-prop'
import PlayerProp from '../../../../src/entities/player-prop'
import Prop from '../../../../src/entities/prop'
import { UserType } from '../../../../src/entities/user'
import { DataExporter } from '../../../../src/lib/queues/data-exports/dataExportProcessor'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import EventFactory from '../../../fixtures/EventFactory'
import GameActivityFactory from '../../../fixtures/GameActivityFactory'
import GameFeedbackFactory from '../../../fixtures/GameFeedbackFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

async function parseCsvString(csvString: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    parse(
      csvString,
      {
        columns: false, // don't auto-detect columns, we want raw rows
        skip_empty_lines: true,
      },
      (err, records) => {
        if (err) reject(err)
        else resolve(records)
      },
    )
  })
}

describe('Data export - generation', () => {
  it('should transform basic columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).one()
    const event = await new EventFactory([player]).one()

    let val = proto.transformColumn('name', event)
    expect(val).toBe(event.name)

    val = proto.transformColumn('createdAt', event)
    expect(val).toBe(event.createdAt.toISOString())

    val = proto.transformColumn('updatedAt', event)
    expect(val).toBe(event.updatedAt.toISOString())

    val = proto.transformColumn('lastSeenAt', player)
    expect(val).toBe(player.lastSeenAt.toISOString())
  })

  it('should transform prop columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'level', '70'),
          new PlayerProp(player, 'guildName', 'The Best Guild'),
        ]),
      }))
      .one()

    let val: string = proto.transformColumn('props.level', player)
    expect(val).toBe('70')

    val = proto.transformColumn('props.guildName', player)
    expect(val).toBe('The Best Guild')

    val = proto.transformColumn('props.nonExistentProp', player)
    expect(val).toBe('')
  })

  it('should transform gameActivityType columns', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken(
      { type: UserType.ADMIN, emailConfirmed: true },
      organisation,
    )

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const activity = await new GameActivityFactory([game], [user])
      .state(() => ({
        type: GameActivityType.API_KEY_CREATED,
      }))
      .one()

    expect(proto.transformColumn('gameActivityType', activity)).toBe('API_KEY_CREATED')
  })

  it('should transform gameActivityExtra columns', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken(
      { type: UserType.ADMIN, emailConfirmed: true },
      organisation,
    )

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const activity = await new GameActivityFactory([game], [user])
      .state(() => ({
        extra: {
          statInternalName: 'hearts-collected',
        },
      }))
      .one()

    expect(proto.transformColumn('gameActivityExtra', activity)).toBe(
      "\"{'statInternalName':'hearts-collected'}\"",
    )
  })

  it('should transform globalValue columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const stat = await new GameStatFactory([game])
      .global()
      .state(() => ({ globalValue: 50, defaultValue: 0 }))
      .one()

    expect(proto.transformColumn('globalValue', stat)).toBe('50')
  })

  it('should fill globalValue columns with N/A for non-global stats', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const stat = await new GameStatFactory([game]).state(() => ({ global: false })).one()

    expect(proto.transformColumn('globalValue', stat)).toBe('N/A')
  })

  it('should transform anonymised feedback columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const feedback = await new GameFeedbackFactory(game).state(() => ({ anonymised: true })).one()

    for (const key of [
      'playerAlias.id',
      'playerAlias.service',
      'playerAlias.identifier',
      'playerAlias.player.id',
    ]) {
      expect(proto.transformColumn(key, feedback)).toBe('Anonymous')
    }
  })

  it('should not transform non-anonymised feedback columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const feedback = await new GameFeedbackFactory(game).state(() => ({ anonymised: false })).one()

    for (const key of [
      'playerAlias.id',
      'playerAlias.service',
      'playerAlias.identifier',
      'playerAlias.player.id',
    ]) {
      expect(proto.transformColumn(key, feedback)).not.toBe('Anonymous')
    }
  })
})

describe('Data export - events pagination', () => {
  it('should return all events when there are more than PAGE_SIZE (10,000)', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const EVENT_COUNT = 20_002
    const events = await new EventFactory([player]).many(EVENT_COUNT)
    events.forEach((e) => e.setProps([new Prop('level', '1'), new Prop('area', 'forest')]))

    await clickhouse.insert({
      table: 'events',
      values: events.map((e) => e.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((e) => e.getInsertableProps()),
      format: 'JSONEachRow',
    })

    const dataExport = await new DataExportFactory(game).one()
    await em.persist(dataExport).flush()

    let count = 0
    for await (const event of proto.streamEvents(dataExport, em, true)) {
      count++
      expect(event.props).toHaveLength(2)
      expect(event.props.find((p: Prop) => p.key === 'level')?.value).toBe('1')
      expect(event.props.find((p: Prop) => p.key === 'area')?.value).toBe('forest')
    }

    expect(count).toBe(EVENT_COUNT)
  })
})

describe('Data export - leaderboard entries with props', () => {
  let tempDir: string
  let dataExporter: DataExporter

  beforeEach(async () => {
    dataExporter = new DataExporter()
    tempDir = path.join(os.tmpdir(), `data-export-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should generate a zip with leaderboardEntries.csv and correct prop columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persist([player1, player2]).flush()

    const leaderboard = await new LeaderboardFactory([game]).notUnique().one()
    await em.persist(leaderboard).flush()

    const entry1 = await new LeaderboardEntryFactory(leaderboard, [player1]).one()
    entry1.props.set([
      new LeaderboardEntryProp(entry1, 'character', 'Warrior'),
      new LeaderboardEntryProp(entry1, 'META_PLATFORM', 'PC'),
    ])
    entry1.propsDigest = LeaderboardEntry.createPropsDigest(entry1.props.getItems())

    const entry2 = await new LeaderboardEntryFactory(leaderboard, [player2]).one()
    entry2.props.set([
      new LeaderboardEntryProp(entry2, 'character', 'Mage'),
      new LeaderboardEntryProp(entry2, 'level', '42'),
    ])
    entry2.propsDigest = LeaderboardEntry.createPropsDigest(entry2.props.getItems())

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.LEADERBOARD_ENTRIES]
    await em.persist([entry1, entry2, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'test-export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'leaderboardEntries-1.csv')
    expect(csvFile).toBeDefined()

    const csvContent = (await csvFile!.buffer()).toString('utf8')
    const records = await parseCsvString(csvContent)

    const header = records[0]
    expect(header).toBeDefined()

    // META_ props sort before other props
    expect(header.indexOf('props.META_PLATFORM')).toBeLessThan(header.indexOf('props.character'))
    expect(header).toContain('props.character')
    expect(header).toContain('props.level')
    expect(header).toContain('props.META_PLATFORM')

    const idIndex = header.indexOf('id')
    const characterIndex = header.indexOf('props.character')
    const levelIndex = header.indexOf('props.level')
    const platformIndex = header.indexOf('props.META_PLATFORM')

    const entry1Row = records.slice(1).find((row) => row[idIndex] === String(entry1.id))
    assert(entry1Row)
    expect(entry1Row[characterIndex]).toBe('Warrior')
    expect(entry1Row[platformIndex]).toBe('PC')
    expect(entry1Row[levelIndex]).toBe('') // missing prop should be empty

    const entry2Row = records.slice(1).find((row) => row[idIndex] === String(entry2.id))
    assert(entry2Row)
    expect(entry2Row[characterIndex]).toBe('Mage')
    expect(entry2Row[levelIndex]).toBe('42')
    expect(entry2Row[platformIndex]).toBe('') // missing prop should be empty
  })
})

describe('Data export - player alias cache eviction', () => {
  it('should re-fetch evicted aliases when they reappear on a later page', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    // shrink page size to 1 so each event is its own page — this forces the eviction
    // loop to run between events and exercises the re-fetch path when a previously
    // evicted alias reappears on a later page
    const pageSizeDescriptor = Object.getOwnPropertyDescriptor(DataExporter, 'EVENT_PAGE_SIZE')!
    const cacheDescriptor = Object.getOwnPropertyDescriptor(DataExporter, 'MAX_ALIAS_CACHE_SIZE')!
    Object.defineProperty(DataExporter, 'EVENT_PAGE_SIZE', { value: 1, configurable: true })
    // cache size 1: after each page, all but the most recent alias is evicted
    Object.defineProperty(DataExporter, 'MAX_ALIAS_CACHE_SIZE', { value: 1, configurable: true })

    try {
      const players = await new PlayerFactory([game]).many(2)
      await em.persist(players).flush()

      // player[0] appears on pages 1 and 3 — page 2 (player[1]) evicts player[0]'s alias,
      // so page 3 must re-fetch it
      const events = [
        await new EventFactory([players[0]]).one(),
        await new EventFactory([players[1]]).one(),
        await new EventFactory([players[0]]).one(),
      ]

      await clickhouse.insert({
        table: 'events',
        values: events.map((e) => e.toInsertable()),
        format: 'JSONEachRow',
      })

      const dataExport = await new DataExportFactory(game).one()
      await em.persist(dataExport).flush()

      let count = 0
      for await (const event of proto.streamEvents(dataExport, em, true)) {
        expect(event.playerAlias).toBeDefined()
        count++
      }

      expect(count).toBe(events.length)
    } finally {
      Object.defineProperty(DataExporter, 'EVENT_PAGE_SIZE', pageSizeDescriptor)
      Object.defineProperty(DataExporter, 'MAX_ALIAS_CACHE_SIZE', cacheDescriptor)
    }
  })
})

describe('Data export - create zip stream', () => {
  let tempDir: string
  let dataExporter: DataExporter

  beforeEach(async () => {
    dataExporter = new DataExporter()
    tempDir = path.join(os.tmpdir(), `data-export-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should generate a zip with players.csv and correct prop column ordering', async () => {
    const [, game] = await createOrganisationAndGame()

    const player1 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'META_OS', 'Windows'),
          new PlayerProp(player, 'currentArea', 'Forest'),
          new PlayerProp(player, 'META_GAME_VERSION', '1.0.0'),
        ]),
      }))
      .one()

    const player2 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'currentHealth', '100'),
          new PlayerProp(player, 'META_SCREEN_WIDTH', '1920'),
        ]),
      }))
      .one()

    const player3 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'level', '5')]),
      }))
      .one()

    const player4 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, []),
      }))
      .one()

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYERS]
    await em.persist([player1, player2, player3, player4, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'test-export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    await readFile(zipFilePath)

    const directory = await unzipper.Open.file(zipFilePath)
    const playerCsvFile = directory.files.find((f) => f.path === 'players-1.csv')
    expect(playerCsvFile).toBeDefined()

    const csvContentBuffer = await playerCsvFile!.buffer()
    const csvContent = csvContentBuffer.toString('utf8')
    const records = await parseCsvString(csvContent)

    const header = records[0]
    expect(header).toBeDefined()

    const expectedBaseColumns = ['id', 'lastSeenAt', 'createdAt', 'updatedAt']
    const expectedMetaProps = [
      'props.META_GAME_VERSION',
      'props.META_OS',
      'props.META_SCREEN_WIDTH',
    ]
    const expectedOtherProps = ['props.currentArea', 'props.currentHealth', 'props.level']
    const expectedHeader = [...expectedBaseColumns, ...expectedMetaProps, ...expectedOtherProps]

    expect(header).toEqual(expectedHeader)

    const dataRows = records.slice(1)
    expect(dataRows).toHaveLength(4)

    const findRowById = (id: string) => {
      const idIndex = header.indexOf('id')
      return dataRows.find((row) => row[idIndex] === id)
    }

    const player1Row = findRowById(player1.id)
    assert(player1Row)
    expect(player1Row[header.indexOf('props.META_OS')]).toBe('Windows')
    expect(player1Row[header.indexOf('props.currentArea')]).toBe('Forest')
    expect(player1Row[header.indexOf('props.META_GAME_VERSION')]).toBe('1.0.0')
    expect(player1Row[header.indexOf('props.currentHealth')]).toBe('') // should be empty for missing prop

    const player2Row = findRowById(player2.id)
    assert(player2Row)
    expect(player2Row[header.indexOf('props.currentHealth')]).toBe('100')
    expect(player2Row[header.indexOf('props.META_SCREEN_WIDTH')]).toBe('1920')
    expect(player2Row[header.indexOf('props.META_OS')]).toBe('') // should be empty for missing prop

    const player3Row = findRowById(player3.id)
    assert(player3Row)
    expect(player3Row[header.indexOf('props.level')]).toBe('5')
    expect(player3Row[header.indexOf('props.META_OS')]).toBe('') // should be empty for missing prop

    const player4Row = findRowById(player4.id)
    assert(player4Row)

    expectedMetaProps.forEach((propCol) => {
      expect(player4Row[header.indexOf(propCol)]).toBe('')
    })
    expectedOtherProps.forEach((propCol) => {
      expect(player4Row[header.indexOf(propCol)]).toBe('')
    })
  })
})
