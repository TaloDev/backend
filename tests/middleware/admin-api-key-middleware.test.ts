import request from 'supertest'
import AdminAPIKey, { AdminAPIKeyScope } from '../../src/entities/admin-api-key.js'
import { ADMIN_API_KEY_LAST_USED_HASH } from '../../src/middleware/admin-api-key-middleware.js'
import { createAdminAPIKey } from '../utils/createAdminAPIKey.js'

describe('Admin API key middleware', () => {
  const statBody = {
    internalName: 'levels-completed',
    name: 'Levels completed',
    defaultValue: 0,
    global: false,
    minTimeBetweenUpdates: 0,
    minValue: -10,
    maxValue: 10,
    maxChange: 1,
  }

  it('should accept a valid admin api request and record lastUsedAt in the redis hash', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    const recorded = await redis.hget(ADMIN_API_KEY_LAST_USED_HASH, String(apiKey.id))
    expect(recorded).not.toBeNull()
  })

  it('should reject unknown admin api keys', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([])
    await em.repo(AdminAPIKey).nativeDelete(apiKey)

    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .auth(keyString, { type: 'bearer' })
      .expect(401)
  })

  it('should not accept an admin api request without an auth header', async () => {
    await request(app).post('/admin/v1/game-stats').send(statBody).expect(401)
  })

  it('should not accept an admin api request without the bearer component of the auth header', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .set('authorization', keyString)
      .expect(401)
  })

  it('should not accept an admin api request with an invalid token', async () => {
    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .auth('blah', { type: 'bearer' })
      .expect(401)
  })

  it('should not accept an admin api request with an empty token', async () => {
    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .auth('', { type: 'bearer' })
      .expect(401)
  })

  it('should not accept an admin api request with a revoked admin api key', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])
    apiKey.revokedAt = new Date()
    await em.flush()

    await request(app)
      .post('/admin/v1/game-stats')
      .send(statBody)
      .auth(keyString, { type: 'bearer' })
      .expect(401)
  })
})
