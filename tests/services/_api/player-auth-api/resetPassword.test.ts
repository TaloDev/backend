import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import bcrypt from 'bcrypt'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'

describe('Player auth API service - reset password', () => {
  it('should reset a player\'s password if the reset code is correct and if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await redis.set(`player-auth:${apiKey.game.id}:password-reset:123456`, alias.id)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.get(`player-auth:${apiKey.game.id}:password-reset:123456`)).toBeNull()

    await em.refresh(player.auth!)
    expect(await bcrypt.compare('password', player.auth!.password)).toBe(true)
    expect(player.auth!.sessionKey).toBeNull()
    expect(player.auth!.sessionCreatedAt).toBeNull()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.PASSWORD_RESET_COMPLETED,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should not reset a player\'s password if the reset code is correct but the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await redis.set(`player-auth:${apiKey.game.id}:password-reset:123456`, alias.id)

    await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(await redis.get(`player-auth:${apiKey.game.id}:password-reset:123456`)).toBe(String(alias.id))
  })

  it('should not reset a player\'s password if the reset code is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]

    await em.persistAndFlush(player)

    await redis.set(`player-auth:${apiKey.game.id}:password-reset:123456`, alias.id)

    const res = await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123455', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'This code is either invalid or has expired',
      errorCode: 'PASSWORD_RESET_CODE_INVALID'
    })

    expect(await redis.get(`player-auth:${apiKey.game.id}:password-reset:123456`)).toBe(String(alias.id))
  })

  it('should return a 401 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]

    await redis.set(`player-auth:${apiKey.game.id}:password-reset:123456`, alias.id)

    const res = await request(app)
      .post('/v1/players/auth/reset_password')
      .send({ code: '123456', password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'This code is either invalid or has expired',
      errorCode: 'PASSWORD_RESET_CODE_INVALID'
    })
  })
})
