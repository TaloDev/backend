import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import User from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import DataExport, { DataExportAvailableEntities, DataExportStatus } from '../../../src/entities/data-export'
import DataExportService from '../../../src/services/data-export.service'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'
import GameActivityFactory from '../../fixtures/GameActivityFactory'
import { GameActivityType } from '../../../src/entities/game-activity'
import GameStatFactory from '../../fixtures/GameStatFactory'
import OrganisationPricingPlanFactory from '../../fixtures/OrganisationPricingPlanFactory'
import OrganisationPricingPlanActionFactory from '../../fixtures/OrganisationPricingPlanActionFactory'
import { PricingPlanActionType } from '../../../src/entities/pricing-plan-action'
import OrganisationPricingPlanAction from '../../../src/entities/organisation-pricing-plan-action'
import PricingPlanFactory from '../../fixtures/PricingPlanFactory'

describe('Data export service - generation', () => {
  let app: Koa
  let user: User
  let game: Game

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').state('email confirmed').one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should transform basic columns', async () => {
    const service = new DataExportService()
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
    const service = new DataExportService()
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

  it('should transform gameActivityType columns', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const activity = await new GameActivityFactory([game], [user]).with(() => ({
      type: GameActivityType.API_KEY_CREATED
    })).one()

    expect(proto.transformColumn('gameActivityType', activity)).toBe('API_KEY_CREATED')
  })

  it('should transform gameActivityExtra columns', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const activity = await new GameActivityFactory([game], [user]).with(() => ({
      extra: {
        statInternalName: 'hearts-collected'
      }
    })).one()

    expect(proto.transformColumn('gameActivityExtra', activity)).toBe('"{\'statInternalName\':\'hearts-collected\'}"')
  })

  it('should transform globalValue columns', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const stat = await new GameStatFactory([game]).state('global').with(() => ({ globalValue: 50 })).one()
    await stat.recalculateGlobalValue(false)

    expect(proto.transformColumn('globalValue', stat)).toBe(50)
  })

  it('should fill globalValue columns with N/A for non-global stats', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const stat = await new GameStatFactory([game]).one()

    expect(proto.transformColumn('globalValue', stat)).toBe('N/A')
  })

  it('should correctly build a CSV', async () => {
    const service = new DataExportService()
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
    const service = new DataExportService()
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
    const service = new DataExportService()
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

  it('should refund data export actions if generation fails', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const dataExport = await new DataExportFactory(game).with(() => ({ status: DataExportStatus.QUEUED })).one()
    await (<EntityManager>app.context.em).persistAndFlush(dataExport)

    const orgPlan = await new OrganisationPricingPlanFactory().with(async () => ({ pricingPlan: await new PricingPlanFactory().one() })).one()
    let orgPlanAction = await new OrganisationPricingPlanActionFactory(orgPlan).with(() => ({
      type: PricingPlanActionType.DATA_EXPORT,
      extra: {
        dataExportId: dataExport.id
      }
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(orgPlanAction)

    await proto.updateDataExportStatus(dataExport.id, { failedAt: new Date() })

    orgPlanAction = await (<EntityManager>app.context.em).getRepository(OrganisationPricingPlanAction).findOne(orgPlanAction.id, { refresh: true })
    expect(orgPlanAction).toBeNull()
  })
})
