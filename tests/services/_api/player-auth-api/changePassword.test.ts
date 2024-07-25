import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'

describe('Player auth API service - change password', () => {
  it('should change a player\'s password if the current password is correct and the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password1' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(await bcrypt.compare('password1', player.auth.password)).toBe(true)
  })

  it('should not change a player\'s password if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password1' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should not change a player\'s password if the current password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password1', newPassword: 'password2' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS'
    })
  })

  it('should not change a player\'s password if the current password is the same as the new password', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .post('/v1/players/auth/change_password')
      .send({ currentPassword: 'password', newPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Please choose a different password',
      errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD'
    })
  })
})
