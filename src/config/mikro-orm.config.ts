import 'dotenv/config'
import { Options } from '@mikro-orm/core'

const opts: Options = {
  entities: ['./entities/*.js'],
  entitiesTs: ['./src/entities/*.ts'],
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.MYSQL_DATABASE,
  user: process.env.DB_USER,
  password: process.env.MYSQL_ROOT_PASSWORD
}

export default opts
