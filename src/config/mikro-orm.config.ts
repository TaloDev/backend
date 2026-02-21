import 'dotenv/config'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig, MikroORM } from '@mikro-orm/mysql'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import { RedisCacheAdapter } from 'mikro-orm-cache-adapter-redis'
import { entities } from '../entities'
import migrationsList from '../migrations'
import { subscribers } from '../subscribers'
import redisConfig from './redis.config'

const ormConfig = defineConfig({
  entities,
  subscribers,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  migrations: {
    migrationsList,
    path: 'src/migrations', // for generating migrations via the cli
  },
  metadataProvider: TsMorphMetadataProvider,
  extensions: [Migrator],
  pool: {
    min: Number(process.env.MIKRO_ORM_POOL_MIN) || 0,
    max: Number(process.env.MIKRO_ORM_POOL_MAX) || 10,
    idleTimeoutMillis: Number(process.env.MIKRO_ORM_POOL_IDLE_TIMEOUT) || undefined,
    acquireTimeoutMillis: Number(process.env.MIKRO_ORM_POOL_ACQUIRE_TIMEOUT) || undefined,
  },
  resultCache: {
    adapter: RedisCacheAdapter,
    options: redisConfig,
  },
  loadStrategy: 'balanced',
})

export default ormConfig // loaded in package.json

let orm: Awaited<ReturnType<typeof MikroORM.init>>
export async function getMikroORM() {
  if (!orm || !(await orm.checkConnection())) {
    orm = await MikroORM.init(ormConfig)
  }
  return orm
}
