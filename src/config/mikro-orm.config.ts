import 'dotenv/config'
import { Options } from '@mikro-orm/core'
import entities from '../entities'

const ormConfig: Options = {
  entities,
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS
}

export default ormConfig
