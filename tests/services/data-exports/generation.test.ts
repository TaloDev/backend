import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../../../src/entities/data-export'
import DataExportsService from '../../../src/services/data-exports.service'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'

const baseUrl = '/data-exports'

describe('Data exports service - post', () => {
  let app: Koa
  let user: User
  let game: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').state('email confirmed').one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should transform basic columns', async () => {
    const service = new DataExportsService()
    const proto = Object.getPrototypeOf(service)

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
    const service = new DataExportsService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).with(() => ({
      props: [
        { key: 'level', value: '70' },
        { key: 'guildName', value: 'The Best Guild' }
      ]
    })).one()

    let val: string = proto.transformColumn('props.level', player)
    expect(val).toBe('70')

    val = proto.transformColumn('props.guildName', player)
    expect(val).toBe('The Best Guild')

    val = proto.transformColumn('props.nonExistentProp', player)
    expect(val).toBe('')
  })

  it('should correctly build a CSV', async () => {
    const service = new DataExportsService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).one()

    const csv: Buffer = proto.buildCSV(DataExportAvailableEntities.PLAYER_ALIASES, player.aliases)

    const lines = csv.toString().split('\n')
    expect(lines[0]).toBe('id,service,identifier,player.id,createdAt,updatedAt')

    for (let i = 0; i < player.aliases.length; i++) {
      const playerAlias = player.aliases[i]
      expect(lines[i+1]).toBe(`${playerAlias.id},${playerAlias.service},${playerAlias.identifier},${playerAlias.player.id},${playerAlias.createdAt.toISOString()},${playerAlias.updatedAt.toISOString()}`)
    }
  })

  it('should correctly build a CSV with prop columns', async () => {
    const service = new DataExportsService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).one()
    const event = await new EventFactory([player]).with(() => ({
      props: [
        { key: 'timeTaken', value: '99' },
        { key: 'prevTime', value: '98' }
      ]
    })).one()

    const csv: Buffer = proto.buildCSV(DataExportAvailableEntities.EVENTS, [event])

    const lines = csv.toString().split('\n')
    expect(lines[0]).toBe('id,name,playerAlias.id,playerAlias.service,playerAlias.identifier,playerAlias.player.id,createdAt,updatedAt,props.prevTime,props.timeTaken')
    expect(lines[1]).toBe(`${event.id},${event.name},${event.playerAlias.id},${event.playerAlias.service},${event.playerAlias.identifier},${event.playerAlias.player.id},${event.createdAt.toISOString()},${event.updatedAt.toISOString()},98,99`)
  })

  it('should correctly update data export statuses', async () => {
    const service = new DataExportsService()
    const proto = Object.getPrototypeOf(service)

    let dataExport = await new DataExportFactory(game).with(() => ({
      status: DataExportStatus.QUEUED
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(dataExport)

    await proto.updateDataExportStatus(dataExport.id, { id: DataExportStatus.GENERATED })
    dataExport = await (<EntityManager>app.context.em).getRepository(DataExport).findOne(dataExport.id, { refresh: true })
    expect(dataExport.status).toBe(DataExportStatus.GENERATED)

    await proto.updateDataExportStatus(dataExport.id, { failedAt: new Date() })
    dataExport = await (<EntityManager>app.context.em).getRepository(DataExport).findOne(dataExport.id, { refresh: true })
    expect(dataExport.failedAt).toBeTruthy()
  })
})
