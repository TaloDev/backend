import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import bcrypt from 'bcrypt'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'

describe('Player auth API service - verify', () => {
  it('should login a player if the verification code is correct and if the api key has the correct scopes', async () => {
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

    await redis.set(`player-auth:${apiKey.game.id}:verification:${alias.id}`, '123456')

    const res = await request(app)
      .post('/v1/players/auth/verify')
      .send({ aliasId: alias.id, code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(alias.identifier)
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      sessionCreatedAt: expect.any(String),
      verificationEnabled: true
    })

    expect(res.body.sessionToken).toBeTruthy()

    expect(await redis.get(`player-auth:${apiKey.game.id}:verification:${alias.id}`)).toBeNull()
  })

  it('should not login a player if the verification code is correct but the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/auth/verify')
      .send({ aliasId: alias.id, code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not login a player if the alias does not exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/auth/verify')
      .send({ aliasId: 812, code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Player alias not found',
      errorCode: 'VERIFICATION_ALIAS_NOT_FOUND'
    })
  })

  it('should not login a player if the verification code is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await redis.set(`player-auth:${apiKey.game.id}:verification:${alias.id}`, '123456')

    const res = await request(app)
      .post('/v1/players/auth/verify')
      .send({ aliasId: alias.id, code: '111111' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Invalid code',
      errorCode: 'VERIFICATION_CODE_INVALID'
    })

    expect(await redis.get(`player-auth:${apiKey.game.id}:verification:${alias.id}`)).toBe('123456')

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_FAILED,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should return a 400 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]

    const res = await request(app)
      .post('/v1/players/auth/verify')
      .send({ aliasId: alias.id, code: '123456' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
