import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'

describe('Player auth API service - change email', () => {
  it('should change a player\'s email if the current password is correct and the api key has the correct scopes', async () => {
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
      .post('/v1/players/auth/change_email')
      .send({ currentPassword: 'password', newEmail: 'bozza@mail.com' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth.email).toBe('bozza@mail.com')
  })

  it('should not change a player\'s email if the api key does not have the correct scopes', async () => {
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
      .post('/v1/players/auth/change_email')
      .send({ currentPassword: 'password', newEmail: 'bozza@mail.com' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should not change a player\'s email if the current password is incorrect', async () => {
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
      .post('/v1/players/auth/change_email')
      .send({ currentPassword: 'password1', newEmail: 'bozza@mail.com' })
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

  it('should not change a player\'s email if the current email is the same as the new email', async () => {
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
      .post('/v1/players/auth/change_email')
      .send({ currentPassword: 'password', newEmail: 'boz@mail.com' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Please choose a different email address',
      errorCode: 'NEW_EMAIL_MATCHES_OLD_EMAIL'
    })
  })
})
