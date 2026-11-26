import { randEmail } from '@ngneat/falso'
import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity.js'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail.js'
import {
  getPasswordResetPrefix,
  getRedisPasswordResetAliasKey,
} from '../../../../src/routes/api/player-auth/common.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Player auth API - forgot password', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(async () => {
    sendMock.mockClear()
  })

  it('should send a reset code if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: player.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`${getPasswordResetPrefix(apiKey)}*`)).toHaveLength(1)
    expect(sendMock).toHaveBeenCalledOnce()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.PASSWORD_RESET_REQUESTED,
      player: player.id,
    })
    expect(activity).not.toBeNull()
  })

  it('should not send a reset code if the the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: player.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(await redis.keys(`${getPasswordResetPrefix(apiKey)}*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should not send a reset code if there are no players with that email address', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: randEmail() })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`${getPasswordResetPrefix(apiKey)}*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should replace the previous reset code when a new one is requested', async () => {
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

    const firstCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const secondCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, alias.id))
    assert(secondCode)

    expect(secondCode).not.toBe(firstCode)
  })

  it("should not overwrite another player's live reset code", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist([player, otherPlayer]).flush()

    const email = player.auth?.email
    const otherEmail = otherPlayer.auth?.email
    assert(email && otherEmail)

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const firstCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, player.aliases[0].id))

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: otherEmail })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const playerCode = await redis.get(getRedisPasswordResetAliasKey(apiKey, player.aliases[0].id))
    const otherCode = await redis.get(
      getRedisPasswordResetAliasKey(apiKey, otherPlayer.aliases[0].id),
    )

    expect(playerCode).toBe(firstCode)
    expect(otherCode).not.toBeNull()
  })

  it('should not send a reset code if the only player with a matching email address is from another game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    const [otherKey] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const otherPlayer = await new PlayerFactory([otherKey.game]).withTaloAlias().one()
    await em.persist([player, otherPlayer]).flush()

    await request(app)
      .post('/v1/players/auth/forgot_password')
      .send({ email: otherPlayer.auth!.email })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await redis.keys(`${getPasswordResetPrefix(apiKey)}*`)).toHaveLength(0)
    expect(sendMock).not.toHaveBeenCalled()
  })
})
