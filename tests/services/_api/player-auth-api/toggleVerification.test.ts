import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'

describe('Player auth API service - toggle verification', () => {
  it('should enable verification if the current password is correct and an email is provided', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth.verificationEnabled).toBe(true)

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERFICIATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: true
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should disable verification if the current password is correct', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: 'boz@mail.com',
        verificationEnabled: true
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: false })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth.verificationEnabled).toBe(false)

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERFICIATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: false
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not enable verification if an email is not provided', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: null,
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'An email address is required to enable verification',
      errorCode: 'VERIFICATION_EMAIL_REQUIRED'
    })

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
      player: player.id,
      extra: {
        errorCode: 'VERIFICATION_EMAIL_REQUIRED',
        verificationEnabled: true
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should update the email of the player if one is sent', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').with(async () => ({
      auth: await new PlayerAuthFactory().with(async () => ({
        password: await bcrypt.hash('password', 10),
        email: null,
        verificationEnabled: false
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true, email: 'bozzz@mail.com' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth.verificationEnabled).toBe(true)
    expect(player.auth.email).toBe('bozzz@mail.com')

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERFICIATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: true
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not toggle verification if the current password is incorrect', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'wrongpassword', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS'
    })

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
      player: player.id,
      extra: {
        errorCode: 'INVALID_CREDENTIALS',
        verificationEnabled: true
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not toggle verification if the api key does not have the correct scopes', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })
})
