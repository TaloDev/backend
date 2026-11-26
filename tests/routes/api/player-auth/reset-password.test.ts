import bcrypt from 'bcrypt'
import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity.js'
import {
  getPasswordResetPrefix,
  getRedisPasswordResetAliasKey,
  getRedisPasswordResetKey,
  storePasswordResetCode,
} from '../../../../src/routes/api/player-auth/common.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Player auth API - reset password', () => {
  it("should reset a player's password if the reset code is correct and if the api key has the correct scopes", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    await storePasswordResetCode(redis, apiKey, alias.id, '123456')

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.get(getRedisPasswordResetKey(apiKey, '123456'))).toBeNull()

    await em.refresh(player.auth!)
    expect(await bcrypt.compare('password', player.auth!.password)).toBe(true)
    expect(player.auth!.sessionKey).toBeNull()
    expect(player.auth!.sessionCreatedAt).toBeNull()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.PASSWORD_RESET_COMPLETED,
      player: player.id,
    })
    expect(activity).not.toBeNull()
  })

  it('should not accept a reset code twice', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const email = player.auth?.email
    assert(email)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const code = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))
    assert(code)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(await redis.get(getRedisPasswordResetKey(apiKey, code))).toBeNull()
  })

  it('should leave one live code when two requests are issued together', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const email = player.auth?.email
    assert(email)

    await Promise.all([
      request(app)
        .post('/v1/players/auth/forgot_password')
        .send({ email })
        .auth(token, { type: 'bearer' })
        .expect(204),
      request(app)
        .post('/v1/players/auth/forgot_password')
        .send({ email })
        .auth(token, { type: 'bearer' })
        .expect(204),
    ])

    const liveCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))
    assert(liveCode)

    const prefix = getPasswordResetPrefix(apiKey)
    const issuedCodes = (await redis.keys(`${prefix}*`)).map((codeKey) =>
      codeKey.slice(prefix.length),
    )

    const supersededCode = issuedCodes.find((code) => code !== liveCode)
    assert(supersededCode, 'no superseded code was issued')

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: supersededCode, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: liveCode, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)
  })

  it('should accept a reset code once when two requests arrive together', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    const email = player.auth?.email
    assert(email)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const code = await redis.get(getRedisPasswordResetAliasKey(apiKey, player.aliases[0].id))
    assert(code)

    const responses = await Promise.all([
      request(app)
        .post('/v1/players/auth/reset_password')
        .send({ code, password: 'password' })
        .auth(token, { type: 'bearer' }),
      request(app)
        .post('/v1/players/auth/reset_password')
        .send({ code, password: 'password' })
        .auth(token, { type: 'bearer' }),
    ])

    expect(responses.map(({ status }) => status).sort()).toStrictEqual([204, 401])
  })

  it('should not accept a superseded reset code', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    const alias = player.aliases[0]

    const email = player.auth?.email
    assert(email)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const oldCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))
    assert(oldCode)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const newCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))
    assert(newCode)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: oldCode, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: newCode, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)
  })

  it('should not accept an expired reset code', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    const email = player.auth?.email
    assert(email)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const code = await redis.get(getRedisPasswordResetAliasKey(apiKey, player.aliases[0].id))
    assert(code)

    await redis.pexpire(getRedisPasswordResetKey(apiKey, code), 50)
    await new Promise((resolve) => setTimeout(resolve, 100))

    const res = await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'This code is either invalid or has expired',
      errorCode: 'PASSWORD_RESET_CODE_INVALID',
    })
  })

  it("should not reset a player's password if the reset code is correct but the api key does not have the correct scopes", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    await storePasswordResetCode(redis, apiKey, alias.id, '123456')

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(await redis.get(getRedisPasswordResetKey(apiKey, '123456'))).toBe(String(alias.id))
  })

  it("should not reset a player's password if the reset code is incorrect", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    await storePasswordResetCode(redis, apiKey, alias.id, '123456')

    const res = await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123455', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'This code is either invalid or has expired',
      errorCode: 'PASSWORD_RESET_CODE_INVALID',
    })

    expect(await redis.get(getRedisPasswordResetKey(apiKey, '123456'))).toBe(String(alias.id))
  })

  it('should return a 401 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const alias = player.aliases[0]

    await storePasswordResetCode(redis, apiKey, alias.id, '123456')

    const res = await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'This code is either invalid or has expired',
      errorCode: 'PASSWORD_RESET_CODE_INVALID',
    })
  })
})
