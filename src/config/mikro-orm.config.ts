import { Options } from '@mikro-orm/core'
import entities from '../entities'
import migrationsList from '../migrations'

const ormConfig: Options = {
  entities,
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  migrations: {
    migrationsList,
    path: 'src/migrations' // for generating migrations via the cli
  }
}

export default ormConfig
