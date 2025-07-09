import EventFactory from '../../fixtures/EventFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import DataExportFactory from '../../fixtures/DataExportFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import GameFeedbackFactory from '../../fixtures/GameFeedbackFactory'
import GameStat from '../../../src/entities/game-stat'
import { DataExporter } from '../../../src/lib/queues/data-exports/dataExportProcessor'

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of gen) {
    result.push(item)
  }
  return result
}

describe('Data export service - included data (unit tests)', () => {
  it('should not include events from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush(dataExport)
    await clickhouse.insert({
      table: 'events',
      values: [event.toInsertable()],
      format: 'JSONEachRow'
    })

    const items = await collect(proto.streamEvents(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include events from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const event = await new EventFactory([player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush(dataExport)
    await clickhouse.insert({
      table: 'events',
      values: [event.toInsertable()],
      format: 'JSONEachRow'
    })

    const items = await collect(proto.streamEvents(dataExport, em, true))
    expect(items).toHaveLength(1)
  })

  it('should not include dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([player, dataExport])

    const items = await collect(proto.streamPlayers(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([player, dataExport])

    const items = await collect(proto.streamPlayers(dataExport, em, true))
    expect(items).toHaveLength(1)
  })

  it('should not include dev build player aliases without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([player, dataExport])

    const items = await collect(proto.streamPlayerAliases(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include dev build player aliases with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([player, dataExport])

    const items = await collect(proto.streamPlayerAliases(dataExport, em, true))
    expect(items).toHaveLength(player.aliases.length)
  })

  it('should not include dev build player leaderboard entries without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([entry, dataExport])

    const items = await collect(proto.streamLeaderboardEntries(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include dev build player leaderboard entries with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([entry, dataExport])

    const items = await collect(proto.streamLeaderboardEntries(dataExport, em, true))
    expect(items).toHaveLength(1)
  })

  it('should recalculate global stat values without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([playerStat, dataExport])

    const items = await collect(proto.streamGameStats(dataExport, em, false)) as GameStat[]
    expect(items[0].hydratedGlobalValue).toBe(40)
  })

  it('should not recalculate global stat values with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([playerStat, dataExport])

    const items = await collect(proto.streamGameStats(dataExport, em, true)) as GameStat[]
    expect(items[0].globalValue).toBe(50)
  })

  it('should not include player stats from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([playerStat, dataExport])

    const items = await collect(proto.streamPlayerGameStats(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include player stats from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const stat = await new GameStatFactory([game]).global().state(() => ({ globalValue: 50 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([playerStat, dataExport])

    const items = await collect(proto.streamPlayerGameStats(dataExport, em, true))
    expect(items).toHaveLength(1)
  })

  it('should not include feedback from dev build players without the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const feedback = await new GameFeedbackFactory(game).state(() => ({
      playerAlias: player.aliases[0]
    })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([feedback, dataExport])

    const items = await collect(proto.streamGameFeedback(dataExport, em, false))
    expect(items).toHaveLength(0)
  })

  it('should include player stats from dev build players with the dev data header', async () => {
    const [, game] = await createOrganisationAndGame()

    const exporter = new DataExporter()
    const proto = Object.getPrototypeOf(exporter)

    const player = await new PlayerFactory([game]).devBuild().one()
    const feedback = await new GameFeedbackFactory(game).state(() => ({
      playerAlias: player.aliases[0]
    })).one()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush([feedback, dataExport])

    const items = await collect(proto.streamGameFeedback(dataExport, em, true))
    expect(items).toHaveLength(1)
  })
})
