import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import User from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import DataExportService from '../../../src/services/data-export.service'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import clearEntities from '../../utils/clearEntities'

describe('Data export service - included data', () => {
  let app: Koa
  let user: User
  let game: Game

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').state('email confirmed').one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['Player'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should not include events from dev build players without the dev data header', async () => {
    await clearEntities(app.context.em, ['Event'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([event, dataExport])

    const items = await proto.getEvents(dataExport, app.context.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include events from dev build players with the dev data header', async () => {
    await clearEntities(app.context.em, ['Event'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([event, dataExport])

    const items = await proto.getEvents(dataExport, app.context.em, true)
    expect(items).toHaveLength(1)
  })

  it('should not include dev build players without the dev data header', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayers(dataExport, app.context.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build players with the dev data header', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayers(dataExport, app.context.em, true)
    expect(items).toHaveLength(1)
  })

  it('should not include dev build player aliases without the dev data header', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayerAliases(dataExport, app.context.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build player aliases with the dev data header', async () => {
    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayerAliases(dataExport, app.context.em, true)
    expect(items).toHaveLength(player.aliases.length)
  })

  it('should not include dev build player leaderboard entries without the dev data header', async () => {
    await clearEntities(app.context.em, ['LeaderboardEntry'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([entry, dataExport])

    const items = await proto.getLeaderboardEntries(dataExport, app.context.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build player leaderboard entries with the dev data header', async () => {
    await clearEntities(app.context.em, ['LeaderboardEntry'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([entry, dataExport])

    const items = await proto.getLeaderboardEntries(dataExport, app.context.em, true)
    expect(items).toHaveLength(1)
  })

  it('should recalculate global stat values without the dev data header', async () => {
    await clearEntities(app.context.em, ['GameStat'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const stat = await new GameStatFactory([game]).state('global').with(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getGameStats(dataExport, app.context.em, false)
    expect(items[0].hydratedGlobalValue).toBe(40)
  })

  it('should not recalculate global stat values with the dev data header', async () => {
    await clearEntities(app.context.em, ['GameStat'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const stat = await new GameStatFactory([game]).state('global').with(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getGameStats(dataExport, app.context.em, true)
    expect(items[0].globalValue).toBe(50)
  })

  it('should not include player stats from dev build players without the dev data header', async () => {
    await clearEntities(app.context.em, ['GameStat'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const stat = await new GameStatFactory([game]).state('global').with(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getPlayerGameStats(dataExport, app.context.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include player stats from dev build players with the dev data header', async () => {
    await clearEntities(app.context.em, ['GameStat'])

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).state('dev build').one()
    const stat = await new GameStatFactory([game]).state('global').with(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>app.context.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getPlayerGameStats(dataExport, app.context.em, true)
    expect(items).toHaveLength(1)
  })
})
