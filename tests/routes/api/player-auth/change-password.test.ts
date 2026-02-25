import bcrypt from 'bcrypt'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player auth API - change password', () => {
  it("should change a player's password if the current password is correct and the api key has the correct scopes", async () => {
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
            email: 'boz@mail.com',
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password1' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await em.refresh(player.auth!)
    expect(await bcrypt.compare('password1', player.auth!.password)).toBe(true)

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGED_PASSWORD,
      player: player.id,
    })
    expect(activity).not.toBeNull()
  })

  it("should not change a player's password if the api key does not have the correct scopes", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            email: 'boz@mail.com',
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password1' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it("should not change a player's password if the current password is incorrect", async () => {
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
            email: 'boz@mail.com',
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password1', newPassword: 'password2' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
      player: player.id,
      extra: {
        errorCode: 'INVALID_CREDENTIALS',
      },
    })
    expect(activity).not.toBeNull()
  })

  it("should not change a player's password if the current password is the same as the new password", async () => {
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
            email: 'boz@mail.com',
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Please choose a different password',
      errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
      player: player.id,
      extra: {
        errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD',
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should return a 400 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]

    const res = await request(app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'newpassword' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', 'fake-session')
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
