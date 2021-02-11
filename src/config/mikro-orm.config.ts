import { Options } from '@mikro-orm/core'

const opts: Options = {
  entities: ['./dist/entities/*.js'],
  entitiesTs: ['./src/entities/*.ts'],
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS
}

export default opts
