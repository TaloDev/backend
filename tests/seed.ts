import 'dotenv/config'
import { Collection, MikroORM } from '@mikro-orm/core'
import UserFactory from './fixtures/UserFactory'
import User from '../src/entities/user'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import Game from '../src/entities/game'
import EventFactory from './fixtures/EventFactory'

(async () => {
  const orm = await MikroORM.init()
  const generator = orm.getSchemaGenerator()
  await generator.dropSchema()
  await generator.createSchema()

  const userFactory = new UserFactory()
  const users = await userFactory.many(20)
  const defaultUser = await userFactory.state('loginable').one()

  const gameFactory = new GameFactory([...users, defaultUser])
  const games = await gameFactory.state('team').many(5)

  const playerFactory = new PlayerFactory(games)
  const players = await playerFactory.many(30)

  const eventFactory = new EventFactory(players)
  const events = await eventFactory.many(100)

  await orm.em.getRepository(User).persistAndFlush([
    defaultUser,
    ...users,
    ...games,
    ...players,
    ...events
  ])

  await orm.close(true)
})()
