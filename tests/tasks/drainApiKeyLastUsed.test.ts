import { EntityManager } from '@mikro-orm/mysql'
import assert from 'node:assert'
import { AdminAPIKeyScope } from '../../src/entities/admin-api-key.js'
import { APIKeyScope } from '../../src/entities/api-key.js'
import { ADMIN_API_KEY_LAST_USED_HASH } from '../../src/middleware/admin-api-key-middleware.js'
import { API_KEY_LAST_USED_HASH } from '../../src/middleware/api-key-middleware.js'
import { drainApiKeyLastUsed } from '../../src/tasks/drainApiKeyLastUsed.js'
import { createAdminAPIKey } from '../utils/createAdminAPIKey.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('drainApiKeyLastUsed', () => {
  it('writes recorded API key timestamps and clears the hash', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    expect(apiKey.lastUsedAt).toBeFalsy()
    await redis.hset(API_KEY_LAST_USED_HASH, String(apiKey.id), Date.now())
    await drainApiKeyLastUsed()

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)
    expect(await redis.hget(API_KEY_LAST_USED_HASH, String(apiKey.id))).toBeNull()
  })

  it('writes recorded admin API key timestamps and clears the hash', async () => {
    const { apiKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    expect(apiKey.lastUsedAt).toBeFalsy()
    await redis.hset(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id), Date.now())
    await drainApiKeyLastUsed()

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)
    expect(await redis.hget(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id))).toBeNull()
  })

  it('is a no-op when the api key hash is empty', async () => {
    await drainApiKeyLastUsed()
    expect(await redis.hgetall(API_KEY_LAST_USED_HASH)).toStrictEqual({})
  })

  it('is a no-op when the admin api key hash is empty', async () => {
    await drainApiKeyLastUsed()
    expect(await redis.hgetall(ADMIN_API_KEY_LAST_USED_HASH)).toStrictEqual({})
  })

  it('continues to drain the API key hash even if a previous value failed', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    vi.spyOn(EntityManager.prototype, 'nativeUpdate').mockRejectedValueOnce(new Error())

    await redis.hset(API_KEY_LAST_USED_HASH, '0', 'thiswillfail')
    await redis.hset(API_KEY_LAST_USED_HASH, String(apiKey.id), Date.now())

    await drainApiKeyLastUsed()

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)
    expect(await redis.hget(API_KEY_LAST_USED_HASH, String(apiKey.id))).toBeNull()
  })

  it('continues to drain the admin API key hash even if a previous value failed', async () => {
    const { apiKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    vi.spyOn(EntityManager.prototype, 'nativeUpdate').mockRejectedValueOnce(new Error())

    await redis.hset(ADMIN_API_KEY_LAST_USED_HASH, '0', 'thiswillfail')
    await redis.hset(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id), Date.now())

    await drainApiKeyLastUsed()

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)
    expect(await redis.hget(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id))).toBeNull()
  })
})
