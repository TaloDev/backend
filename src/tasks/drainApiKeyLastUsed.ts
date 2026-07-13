import { EntityManager, EntityName } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { Redis } from 'ioredis'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { getGlobalRedis } from '../config/redis.config.js'
import AdminAPIKey from '../entities/admin-api-key.js'
import APIKey from '../entities/api-key.js'
import { ADMIN_API_KEY_LAST_USED_HASH } from '../middleware/admin-api-key-middleware.js'
import { API_KEY_LAST_USED_HASH } from '../middleware/api-key-middleware.js'

async function drainKeyForEntity({
  key,
  entity,
  redis,
  em,
}: {
  key: string
  entity: EntityName
  redis: Redis
  em: EntityManager
}) {
  const entries = await redis.hgetall(key)
  if (Object.keys(entries).length === 0) {
    return
  }

  for (const [id, lastUsedAtMs] of Object.entries(entries)) {
    try {
      await em
        .repo(entity)
        .nativeUpdate({ id: Number(id) }, { lastUsedAt: new Date(Number(lastUsedAtMs)) })
    } catch (err) {
      captureException(err)
    }
  }

  await redis.del(key)
}

export async function drainApiKeyLastUsed() {
  const redis = getGlobalRedis()
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  await Promise.allSettled([
    drainKeyForEntity({
      key: API_KEY_LAST_USED_HASH,
      entity: APIKey,
      redis,
      em,
    }),
    drainKeyForEntity({
      key: ADMIN_API_KEY_LAST_USED_HASH,
      entity: AdminAPIKey,
      redis,
      em,
    }),
  ])
}
