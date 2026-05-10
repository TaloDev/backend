import { parse } from 'csv-parse'
import { rm, mkdir } from 'fs/promises'
import assert from 'node:assert'
import * as os from 'os'
import path from 'path'
import * as unzipper from 'unzipper'
import { DataExportAvailableEntities } from '../../../../src/entities/data-export'
import Prop from '../../../../src/entities/prop'
import { DataExporter } from '../../../../src/lib/queues/data-exports/dataExportProcessor'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import EventFactory from '../../../fixtures/EventFactory'
import GameFeedbackFactory from '../../../fixtures/GameFeedbackFactory'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

async function parseCsvString(csvString: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    parse(
      csvString,
      {
        columns: false,
        skip_empty_lines: true,
      },
      (err, records) => {
        if (err) {
          reject(err)
        } else {
          resolve(records)
        }
      },
    )
  })
}

describe('Data export - included data', () => {
  let tempDir: string
  let dataExporter: DataExporter

  beforeEach(async () => {
    dataExporter = new DataExporter()
    tempDir = path.join(os.tmpdir(), `data-export-included-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should not include events from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    event.setProps([new Prop('currentLevel', '80')])

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.EVENTS]
    await em.persist(dataExport).flush()

    await clickhouse.insert({ table: 'events', values: event.toInsertable(), format: 'JSON' })
    await clickhouse.insert({
      table: 'event_props',
      values: event.getInsertableProps(),
      format: 'JSONEachRow',
    })

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'events-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only, no data rows
  })

  it('should include events from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    event.setProps([new Prop('currentLevel', '80')])

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.EVENTS]
    await em.persist(dataExport).flush()

    await clickhouse.insert({ table: 'events', values: event.toInsertable(), format: 'JSON' })
    await clickhouse.insert({
      table: 'event_props',
      values: event.getInsertableProps(),
      format: 'JSONEachRow',
    })

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'events-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2) // header + 1 data row
  })

  it('should fetch props for live players when includeDevData is false', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).one()
    const event = await new EventFactory([player]).one()
    event.setProps([new Prop('currentLevel', '80')])

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.EVENTS]
    await em.persist(dataExport).flush()

    await clickhouse.insert({ table: 'events', values: event.toInsertable(), format: 'JSON' })
    await clickhouse.insert({
      table: 'event_props',
      values: event.getInsertableProps(),
      format: 'JSONEachRow',
    })

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'events-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2)

    const header = records[0]
    const nameIndex = header.indexOf('name')
    const propIndex = header.indexOf('props.currentLevel')
    expect(records[1][nameIndex]).toBe(event.name)
    expect(records[1][propIndex]).toBe('80')
  })

  it('should not include dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYERS]
    await em.persist([player, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'players-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only
  })

  it('should include dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYERS]
    await em.persist([player, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'players-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2)
  })

  it('should not include dev build player aliases without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYER_ALIASES]
    await em.persist([player, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'playerAliases-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only
  })

  it('should include dev build player aliases with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYER_ALIASES]
    await em.persist([player, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'playerAliases-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    await player.aliases.loadItems()
    expect(records).toHaveLength(1 + player.aliases.length)
  })

  it('should not include dev build player leaderboard entries without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.LEADERBOARD_ENTRIES]
    await em.persist([entry, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'leaderboardEntries-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only
  })

  it('should include dev build player leaderboard entries with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.LEADERBOARD_ENTRIES]
    await em.persist([entry, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'leaderboardEntries-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2)
  })

  it('should not include player stats from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).state(() => ({ defaultValue: 0 })).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 10 }))
      .one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYER_GAME_STATS]
    await em.persist([playerStat, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'playerGameStats-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only
  })

  it('should include player stats from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).state(() => ({ defaultValue: 0 })).one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player, stat)
      .state(() => ({ value: 10 }))
      .one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYER_GAME_STATS]
    await em.persist([playerStat, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'playerGameStats-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2)
  })

  it('should recalculate global stat values in CSV when exporting without dev data', async () => {
    const [, game] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([game])
      .global()
      .state(() => ({ globalValue: 50, defaultValue: 0 }))
      .one()

    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    const devPlayerStat = await new PlayerGameStatFactory()
      .construct(devPlayer, stat)
      .state(() => ({ value: 10 }))
      .one()

    const livePlayer = await new PlayerFactory([game]).one()
    const livePlayerStat = await new PlayerGameStatFactory()
      .construct(livePlayer, stat)
      .state(() => ({ value: 40 }))
      .one()

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.GAME_STATS]
    await em.persist([devPlayerStat, livePlayerStat, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'gameStats-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))

    const globalValueIndex = records[0].indexOf('globalValue')
    expect(records[1][globalValueIndex]).toBe('40')
  })

  it('should preserve global stat value in CSV when exporting with dev data', async () => {
    const [, game] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([game])
      .global()
      .state(() => ({ globalValue: 50, defaultValue: 0 }))
      .one()

    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    const devPlayerStat = await new PlayerGameStatFactory()
      .construct(devPlayer, stat)
      .state(() => ({ value: 10 }))
      .one()

    const livePlayer = await new PlayerFactory([game]).one()
    const livePlayerStat = await new PlayerGameStatFactory()
      .construct(livePlayer, stat)
      .state(() => ({ value: 40 }))
      .one()

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.GAME_STATS]
    await em.persist([devPlayerStat, livePlayerStat, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'gameStats-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))

    const globalValueIndex = records[0].indexOf('globalValue')
    expect(records[1][globalValueIndex]).toBe('50')
  })

  it('should not include feedback from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const feedback = await new GameFeedbackFactory(game)
      .state(() => ({ playerAlias: player.aliases[0] }))
      .one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.GAME_FEEDBACK]
    await em.persist([feedback, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, false)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'gameFeedback-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(1) // header only
  })

  it('should include feedback from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).devBuild().one()
    const feedback = await new GameFeedbackFactory(game)
      .state(() => ({ playerAlias: player.aliases[0] }))
      .one()
    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.GAME_FEEDBACK]
    await em.persist([feedback, dataExport]).flush()

    const zipFilePath = path.join(tempDir, 'export.zip')
    await dataExporter.createZipStream(zipFilePath, dataExport, em, true)

    const directory = await unzipper.Open.file(zipFilePath)
    const csvFile = directory.files.find((f) => f.path === 'gameFeedback-1.csv')
    assert(csvFile)
    const records = await parseCsvString((await csvFile.buffer()).toString('utf8'))
    expect(records).toHaveLength(2)
  })
})
