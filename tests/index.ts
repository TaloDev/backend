import { MikroORM } from '@mikro-orm/core'
import config from '../src/config/mikro-orm.config'
import genUsers from './fixtures/users.fixture'
import genGames from './fixtures/games.fixture'
import genPlayers from './fixtures/players.fixture'

const init = async () => {
  const orm = await MikroORM.init(config)
  await orm.getSchemaGenerator().dropSchema()
  await orm.getSchemaGenerator().createSchema()
  
  await genUsers(orm.em)
  await genGames(orm.em)
  await genPlayers(orm.em)

  process.exit(0)
}

init()
