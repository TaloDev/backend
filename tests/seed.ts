import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import EventFactory from './fixtures/EventFactory'
import OrganisationFactory from './fixtures/OrganisationFactory'
import LeaderboardFactory from './fixtures/LeaderboardFactory'
import GameSaveFactory from './fixtures/GameSaveFactory'
import GameStatFactory from './fixtures/GameStatFactory'
import PlayerGameStatFactory from './fixtures/PlayerGameStatFactory'
import casual from 'casual'

(async () => {
  const orm = await MikroORM.init()
  await orm.getSchemaGenerator().dropSchema()
  await orm.em.getConnection().execute('drop table if exists mikro_orm_migrations')
  await orm.getMigrator().up()

  const organisation = await new OrganisationFactory().with(() => ({ name: process.env.DEMO_ORGANISATION_NAME })).one()

  const userFactory = new UserFactory()
  const users = await userFactory.with(() => ({ organisation })).many(4)

  const devUser = await userFactory.state('loginable').with(() => ({
    organisation,
    email: 'dev@trytalo.com'
  })).one()

  const adminUser = await userFactory.state('loginable').state('admin').with(() => ({
    organisation,
    email: 'admin@trytalo.com'
  })).one()

  const games = await new GameFactory(organisation).many(2)

  const players = await new PlayerFactory(games).many(50)

  const eventsThisMonth = await new EventFactory(players).state('this month').many(300)

  const leaderboards = await new LeaderboardFactory(games).state('with entries').many(6)

  const gameSaves = await new GameSaveFactory(players).many(10)

  const gameStats = await new GameStatFactory(games).many(10)

  const playerGameStats = []
  for (const gameStat of gameStats) {
    if (!gameStat.global) {
      const player = casual.random_element(players.filter((player) => player.game === gameStat.game))
      const playerGameStat = await new PlayerGameStatFactory().construct(player, gameStat).one()
      playerGameStats.push(playerGameStat)
    }
  }

  const em = orm.em.fork()

  await em.persistAndFlush([
    devUser,
    adminUser,
    organisation,
    ...users,
    ...games,
    ...players,
    ...eventsThisMonth,
    ...leaderboards,
    ...gameSaves,
    ...gameStats,
    ...playerGameStats
  ])

  await orm.close(true)
})()
