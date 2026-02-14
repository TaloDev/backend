import { Collection } from '@mikro-orm/mysql'
import { UserType } from '../../../../src/entities/user'
import { DataExportAvailableEntities } from '../../../../src/entities/data-export'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameActivityFactory from '../../../fixtures/GameActivityFactory'
import { GameActivityType } from '../../../../src/entities/game-activity'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import PlayerProp from '../../../../src/entities/player-prop'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import GameFeedbackFactory from '../../../fixtures/GameFeedbackFactory'
import { DataExporter } from '../../../../src/lib/queues/data-exports/dataExportProcessor'
import { readFile, rm, mkdir } from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse'
import * as unzipper from 'unzipper'
import * as os from 'os'
import assert from 'node:assert'

async function parseCsvString(csvString: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    parse(csvString, {
      columns: false, // don't auto-detect columns, we want raw rows
      skip_empty_lines: true
    }, (err, records) => {
      if (err) reject(err)
      else resolve(records)
    })
  })
}

describe('Data export  - generation', () => {
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

    const player = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'level', '70'),
        new PlayerProp(player, 'guildName', 'The Best Guild')
      ])
    })).one()

    let val: string = proto.transformColumn('props.level', player)
    expect(val).toBe('70')

    val = proto.transformColumn('props.guildName', player)
    expect(val).toBe('The Best Guild')

    val = proto.transformColumn('props.nonExistentProp', player)
    expect(val).toBe('')
  })

  it('should transform gameActivityType columns', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const activity = await new GameActivityFactory([game], [user]).state(() => ({
      type: GameActivityType.API_KEY_CREATED
    })).one()

    expect(proto.transformColumn('gameActivityType', activity)).toBe('API_KEY_CREATED')
  })

  it('should transform gameActivityExtra columns', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const activity = await new GameActivityFactory([game], [user]).state(() => ({
      extra: {
        statInternalName: 'hearts-collected'
      }
    })).one()

    expect(proto.transformColumn('gameActivityExtra', activity)).toBe('"{\'statInternalName\':\'hearts-collected\'}"')
  })

  it('should transform globalValue columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50, defaultValue: 0 })).one()

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

    for (const key of ['playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id']) {
      expect(proto.transformColumn(key, feedback)).toBe('Anonymous')
    }
  })

  it('should not transform non-anonymised feedback columns', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const feedback = await new GameFeedbackFactory(game).state(() => ({ anonymised: false })).one()

    for (const key of ['playerAlias.id', 'playerAlias.service', 'playerAlias.identifier', 'playerAlias.player.id']) {
      expect(proto.transformColumn(key, feedback)).not.toBe('Anonymous')
    }
  })
})

describe('Data export  - createZipStream', () => {
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

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'META_OS', 'Windows'),
        new PlayerProp(player, 'currentArea', 'Forest'),
        new PlayerProp(player, 'META_GAME_VERSION', '1.0.0')
      ])
    })).one()

    const player2 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentHealth', '100'),
        new PlayerProp(player, 'META_SCREEN_WIDTH', '1920')
      ])
    })).one()

    const player3 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'level', '5')
      ])
    })).one()

    const player4 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [])
    })).one()

    const dataExport = await new DataExportFactory(game).one()
    dataExport.entities = [DataExportAvailableEntities.PLAYERS]
    await em.persistAndFlush([player1, player2, player3, player4, dataExport])

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
      'props.META_SCREEN_WIDTH'
    ]
    const expectedOtherProps = [
      'props.currentArea',
      'props.currentHealth',
      'props.level'
    ]
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
