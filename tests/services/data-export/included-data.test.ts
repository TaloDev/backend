import { EntityManager } from '@mikro-orm/mysql'
import DataExportService from '../../../src/services/data-export.service'
import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Data export service - included data', () => {
  it('should not include events from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([event, dataExport])

    const items = await proto.getEvents(dataExport, global.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include events from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([event, dataExport])

    const items = await proto.getEvents(dataExport, global.em, true)
    expect(items).toHaveLength(1)
  })

  it('should not include dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayers(dataExport, global.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayers(dataExport, global.em, true)
    expect(items).toHaveLength(1)
  })

  it('should not include dev build player aliases without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayerAliases(dataExport, global.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build player aliases with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([player, dataExport])

    const items = await proto.getPlayerAliases(dataExport, global.em, true)
    expect(items).toHaveLength(player.aliases.length)
  })

  it('should not include dev build player leaderboard entries without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([entry, dataExport])

    const items = await proto.getLeaderboardEntries(dataExport, global.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include dev build player leaderboard entries with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([entry, dataExport])

    const items = await proto.getLeaderboardEntries(dataExport, global.em, true)
    expect(items).toHaveLength(1)
  })

  it('should recalculate global stat values without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getGameStats(dataExport, global.em, false)
    expect(items[0].hydratedGlobalValue).toBe(40)
  })

  it('should not recalculate global stat values with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getGameStats(dataExport, global.em, true)
    expect(items[0].globalValue).toBe(50)
  })

  it('should not include player stats from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getPlayerGameStats(dataExport, global.em, false)
    expect(items).toHaveLength(0)
  })

  it('should include player stats from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const service = new DataExportService()
    const proto = Object.getPrototypeOf(service)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await (<EntityManager>global.em).persistAndFlush([playerStat, dataExport])

    const items = await proto.getPlayerGameStats(dataExport, global.em, true)
    expect(items).toHaveLength(1)
  })
})
