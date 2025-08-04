import 'dotenv/config'
import entities from '../entities'
import subscribers from '../entities/subscribers'
import migrationsList from '../migrations'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/mysql'
import { RedisCacheAdapter } from 'mikro-orm-cache-adapter-redis'
import redisConfig from './redis.config'

export default defineConfig({
  entities,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dbName: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  migrations: {
    migrationsList,
    path: 'src/migrations' // for generating migrations via the cli
  },
  subscribers,
  metadataProvider: TsMorphMetadataProvider,
  extensions: [Migrator],
  pool: {
    min: Number(process.env.MIKRO_ORM_POOL_MIN) || 2,
    max: Number(process.env.MIKRO_ORM_POOL_MAX) || 10
  },
  resultCache: {
    adapter: RedisCacheAdapter,
    options: redisConfig
  }
})
