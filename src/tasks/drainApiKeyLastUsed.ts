import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { getGlobalRedis } from '../config/redis.config.js'
import APIKey from '../entities/api-key.js'
import { API_KEY_LAST_USED_HASH } from '../middleware/api-key-middleware.js'

export async function drainApiKeyLastUsed() {
  const redis = getGlobalRedis()
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const entries = await redis.hgetall(API_KEY_LAST_USED_HASH)
  const ids = Object.keys(entries)

  if (ids.length === 0) {
    return
  }

  for (const [id, lastUsedAtMs] of Object.entries(entries)) {
    await em
      .repo(APIKey)
      .nativeUpdate({ id: Number(id) }, { lastUsedAt: new Date(Number(lastUsedAtMs)) })
  }

  await redis.del(API_KEY_LAST_USED_HASH)
}
