import { Options } from '@mikro-orm/core'

const opts: Options = {
  entities: ['./dist/entities/*.js'],
  entitiesTs: ['./src/entities/*.ts'],
  dbName: 'gs',
  type: 'mysql',
  user: 'root',
  password: 'password'
}

export default opts
