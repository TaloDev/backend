import 'dotenv/config'
import { MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import User from '../src/entities/user'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import EventFactory from './fixtures/EventFactory'

(async () => {
  const orm = await MikroORM.init()
  const generator = orm.getSchemaGenerator()
  await generator.dropSchema()
  await generator.createSchema()

  const userFactory = new UserFactory()
  const users = await userFactory.many(10)
  const defaultUser = await userFactory.state('loginable').one()

  const gameFactory = new GameFactory([...users, defaultUser])
  const games = await gameFactory.state('team').many(2)

  const playerFactory = new PlayerFactory(games)
  const players = await playerFactory.many(30)

  const eventFactory = new EventFactory(players)
  // const eventsThisWeek = await eventFactory.state('thisWeek').many(100)
  const eventsThisMonth = await eventFactory.state('thisMonth').many(300)
  // const eventsThisYear = await eventFactory.state('thisYear').many(100)

  await orm.em.getRepository(User).persistAndFlush([
    defaultUser,
    ...users,
    ...games,
    ...players,
    // ...eventsThisWeek,
    ...eventsThisMonth,
    // ...eventsThisYear
  ])

  await orm.close(true)
})()
