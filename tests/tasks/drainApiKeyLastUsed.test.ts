import assert from 'node:assert'
import { APIKeyScope } from '../../src/entities/api-key.js'
import { API_KEY_LAST_USED_HASH } from '../../src/middleware/api-key-middleware.js'
import { drainApiKeyLastUsed } from '../../src/tasks/drainApiKeyLastUsed.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('drainApiKeyLastUsed', () => {
  it('writes recorded timestamps and clears the hash', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    expect(apiKey.lastUsedAt).toBeFalsy()
    await redis.hset(API_KEY_LAST_USED_HASH, String(apiKey.id), Date.now())
    await drainApiKeyLastUsed()

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)
    expect(await redis.hget(API_KEY_LAST_USED_HASH, String(apiKey.id))).toBeNull()
  })

  it('is a no-op when the hash is empty', async () => {
    await drainApiKeyLastUsed()
    expect(await redis.hgetall(API_KEY_LAST_USED_HASH)).toStrictEqual({})
  })
})
