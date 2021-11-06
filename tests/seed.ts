import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import EventFactory from './fixtures/EventFactory'
import OrganisationFactory from './fixtures/OrganisationFactory'
import LeaderboardFactory from './fixtures/LeaderboardFactory'

(async () => {
  const orm = await MikroORM.init()
  const generator = orm.getSchemaGenerator()
  await generator.dropSchema()
  await generator.createSchema()

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

  const gameFactory = new GameFactory(organisation)
  const games = await gameFactory.many(2)

  const playerFactory = new PlayerFactory(games)
  const players = await playerFactory.many(50)

  const eventFactory = new EventFactory(players)
  const eventsThisMonth = await eventFactory.state('this month').many(300)

  const leaderboardFactory = new LeaderboardFactory(games)
  const leaderboards = await leaderboardFactory.many(6)

  await orm.em.persistAndFlush([
    devUser,
    adminUser,
    organisation,
    ...users,
    ...games,
    ...players,
    ...eventsThisMonth,
    ...leaderboards
  ])

  await orm.close(true)
})()
