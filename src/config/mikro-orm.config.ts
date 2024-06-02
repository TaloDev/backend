import entities from '../entities/index.js'
import subscribers from '../entities/subscribers/index.js'
import migrationsList from '../migrations/index.js'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/mysql'

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
  extensions: [Migrator]
})
