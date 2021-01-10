import { MikroORM } from '@mikro-orm/core'
import config from '../src/mikro-orm.config'
import generateTeams from './fixtures/team-fixtures'
import generateUsers from './fixtures/user-fixtures'
import generateGames from './fixtures/game-fixtures'
import generatePlayers from './fixtures/player-fixtures'

const init = async () => {
  const orm = await MikroORM.init(config)
  await orm.getSchemaGenerator().dropSchema()
  await orm.getSchemaGenerator().createSchema()
  
  await generateTeams(orm.em)
  await generateUsers(orm.em)
  await generateGames(orm.em)
  await generatePlayers(orm.em)

  process.exit(0)
}

init()
