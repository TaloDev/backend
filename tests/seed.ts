import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import EventFactory from './fixtures/EventFactory'
import OrganisationFactory from './fixtures/OrganisationFactory'

(async () => {
  const orm = await MikroORM.init()
  const generator = orm.getSchemaGenerator()
  await generator.dropSchema()
  await generator.createSchema()

  const organisations = await new OrganisationFactory().many(3)

  for (let organisation of organisations) {
    const userFactory = new UserFactory()
    const users = await userFactory.with(() => ({ organisation })).many(4)

    const devUser = await userFactory.state('loginable').with(() => ({
      organisation,
      email: `dev${organisations.indexOf(organisation) + 1}@trytalo.com`
    })).one()

    const adminUser = await userFactory.state('loginable').state('admin').with(() => ({
      organisation,
      email: `admin${organisations.indexOf(organisation) + 1}@trytalo.com`
    })).one()

    const gameFactory = new GameFactory(organisation)
    const games = await gameFactory.many(2)

    const playerFactory = new PlayerFactory(games)
    const players = await playerFactory.many(20)
  
    const eventFactory = new EventFactory(players)
    const eventsThisMonth = await eventFactory.state('thisMonth').many(200)

    await orm.em.persistAndFlush([
      organisation,
      devUser,
      adminUser,
      ...users,
      ...games,
      ...players,
      ...eventsThisMonth
    ])
  }

  await orm.close(true)
})()
