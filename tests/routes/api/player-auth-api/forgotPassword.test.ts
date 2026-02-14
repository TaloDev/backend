import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import { randEmail } from '@ngneat/falso'

describe('Player auth API  - forgot password', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(async () => {
    sendMock.mockClear()
  })

  it('should send a reset code if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: player.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`player-auth:${apiKey.game.id}:password-reset:*`)).toHaveLength(1)
    expect(sendMock).toHaveBeenCalledOnce()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.PASSWORD_RESET_REQUESTED,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should not send a reset code if the the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: player.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(await redis.keys(`player-auth:${apiKey.game.id}:password-reset:*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a reset code if there are no players with that email address', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: randEmail() })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`player-auth:${apiKey.game.id}:password-reset:*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a reset code if the only player with a matching email address is from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
    const [otherKey] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const otherPlayer = await new PlayerFactory([otherKey.game]).withTaloAlias().one()
    await em.persistAndFlush([player, otherPlayer])

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: otherPlayer.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`player-auth:${apiKey.game.id}:password-reset:*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
