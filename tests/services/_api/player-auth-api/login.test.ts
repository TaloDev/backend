import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import bcrypt from 'bcrypt'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import Redis from 'ioredis'
import redisConfig from '../../../../src/config/redis.config'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'

describe('Player auth API service - login', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should login a player if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/auth/login')
      .send({ identifier: alias.identifier, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(alias.identifier)
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      sessionCreatedAt: expect.any(String),
      verificationEnabled: false
    })

    expect(res.body.sessionToken).toBeTruthy()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.LOGGED_IN,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should not login a player if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/auth/login')
      .send({ identifier: alias.identifier, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not login a player if the password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/auth/login')
      .send({ identifier: alias.identifier, password: 'passw0rd' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Incorrect identifier or password',
      errorCode: 'INVALID_CREDENTIALS'
    })
  })

  it('should not login a player if the identifier does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()

    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/auth/login')
      .send({ identifier: 'blah', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Incorrect identifier or password',
      errorCode: 'INVALID_CREDENTIALS'
    })
  })

  it('should send a verification code if verification is enabled', async () => {
    const redis = new Redis(redisConfig)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: true
      })).one()
    })).one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/auth/login')
      .send({ identifier: alias.identifier, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body).toStrictEqual({
      aliasId: alias.id,
      verificationRequired: true
    })

    expect(await redis.get(`player-auth:${apiKey.game.id}:verification:${alias.id}`)).toHaveLength(6)
    expect(sendMock).toHaveBeenCalledOnce()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_STARTED,
      player: player.id
    })
    expect(activity).not.toBeNull()

    await redis.quit()
  })
})
