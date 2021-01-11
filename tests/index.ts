import { MikroORM } from '@mikro-orm/core'
import config from '../src/config/mikro-orm.config'
import genTeams from './fixtures/teams.fixture'
import genUsers from './fixtures/users.fixture'
import genGames from './fixtures/games.fixture'
import genPlayers from './fixtures/players.fixture'

const init = async () => {
  const orm = await MikroORM.init(config)
  await orm.getSchemaGenerator().dropSchema()
  await orm.getSchemaGenerator().createSchema()
  
  await genTeams(orm.em)
  await genUsers(orm.em)
  await genGames(orm.em)
  await genPlayers(orm.em)

  process.exit(0)
}

init()
