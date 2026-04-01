import bcrypt from 'bcrypt'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player auth API - refresh', () => {
  it('should return new session and refresh tokens for a valid refresh token', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { refreshToken } = await player.auth!.createSession(alias, true)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.sessionToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
    expect(res.body.refreshToken).not.toBe(refreshToken)

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.SESSION_REFRESHED,
      player: player.id,
    })
    expect(activity).not.toBeNull()
  })

  it('should invalidate the old refresh token after use', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { refreshToken } = await player.auth!.createSession(alias, true)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should not accept a session token as a refresh token', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias, true)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken: sessionToken })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should not accept a legacy session token as a refresh token', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken: sessionToken })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should not accept a malformed token', async () => {
    const [, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should not accept a refresh token from another game', async () => {
    const [apiKey] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    const [, otherToken] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { refreshToken } = await player.auth!.createSession(alias, true)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken })
      .auth(otherToken, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_SESSION')
  })

  it('should succeed even when x-talo-player and x-talo-alias headers are provided', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]

    await em.persist(player).flush()

    const { refreshToken } = await player.auth!.createSession(alias, true)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .expect(200)

    expect(res.body.sessionToken).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
  })

  it('should not refresh without the correct api key scopes', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .post('/v1/players/auth/refresh')
      .send({ refreshToken: 'token' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
