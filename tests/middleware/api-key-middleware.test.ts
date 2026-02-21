import assert from 'node:assert'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../src/entities/api-key'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('API key middleware', () => {
  it('should accept a valid api request', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    await request(app).get('/v1/game-config').auth(token, { type: 'bearer' }).expect(200)

    await em.refresh(apiKey)
    expect(apiKey.lastUsedAt).not.toBeNull()
  })

  it('should reject unknown api keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    await em.repo(APIKey).nativeDelete(apiKey)

    await request(app).get('/v1/players/identify').auth(token, { type: 'bearer' }).expect(401)
  })

  it('should not accept an api request without an auth header', async () => {
    const res = await request(app).get('/v1/game-config').expect(401)

    expect(res.body).toStrictEqual({ message: 'Authentication Error' })
  })

  it('should not accept an api request without the bearer component of the auth header', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    const res = await request(app).get('/v1/game-config').set('authorization', token).expect(401)

    expect(res.body).toStrictEqual({
      message: 'Bad Authorization header format. Format is "Authorization: Bearer <token>"',
    })
  })

  it('should not accept an api request with an invalid token', async () => {
    const res = await request(app)
      .get('/v1/game-config')
      .auth('blah', { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Please provide a valid token in the Authorization header',
    })
  })

  it('should not accept an api request with an empty token', async () => {
    const res = await request(app).get('/v1/game-config').auth('', { type: 'bearer' }).expect(401)

    expect(res.body).toStrictEqual({
      message: 'Bad Authorization header format. Format is "Authorization: Bearer <token>"',
    })
  })

  it('should not accept an api request with a revoked api key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])
    apiKey.revokedAt = new Date()
    await em.flush()

    const res = await request(app)
      .get('/v1/game-config')
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Please provide a valid token in the Authorization header',
    })
  })

  it('should not update an api key last used at if the difference in minutes is less than 1', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CONFIG])

    await request(app).get('/v1/game-config').auth(token, { type: 'bearer' }).expect(200)

    await em.refresh(apiKey)
    const lastUsedAt = apiKey.lastUsedAt
    assert(lastUsedAt)

    await request(app).get('/v1/game-config').auth(token, { type: 'bearer' }).expect(200)

    await em.refresh(apiKey)
    assert(apiKey.lastUsedAt)

    expect(apiKey.lastUsedAt.toISOString()).toBe(lastUsedAt.toISOString())
  })
})
