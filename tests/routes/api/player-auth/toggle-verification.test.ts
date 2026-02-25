import bcrypt from 'bcrypt'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player auth API - toggle verification', () => {
  it('should enable verification if the current password is correct and an email is provided', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await em.refresh(player.auth!)
    expect(player.auth!.verificationEnabled).toBe(true)

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should disable verification if the current password is correct', async () => {
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
            verificationEnabled: true,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: false })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await em.refresh(player.auth!)
    expect(player.auth!.verificationEnabled).toBe(false)

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: false,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should not enable verification if an email is not provided', async () => {
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
            email: null,
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'An email address is required to enable verification',
      errorCode: 'VERIFICATION_EMAIL_REQUIRED',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
      player: player.id,
      extra: {
        errorCode: 'VERIFICATION_EMAIL_REQUIRED',
        verificationEnabled: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should update the email of the player if one is sent', async () => {
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
            email: null,
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true, email: 'bozzz@mail.com' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await em.refresh(player.auth!)
    expect(player.auth!.verificationEnabled).toBe(true)
    expect(player.auth!.email).toBe('bozzz@mail.com')

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_TOGGLED,
      player: player.id,
      extra: {
        verificationEnabled: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should not toggle verification if the current password is incorrect', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'wrongpassword', verificationEnabled: true })
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
      type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
      player: player.id,
      extra: {
        errorCode: 'INVALID_CREDENTIALS',
        verificationEnabled: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should not toggle verification if the api key does not have the correct scopes', async () => {
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should not enable verification if the provided email is invalid', async () => {
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
            email: null,
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true, email: 'blah' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Invalid email address',
      errorCode: 'INVALID_EMAIL',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
      player: player.id,
      extra: {
        errorCode: 'INVALID_EMAIL',
        verificationEnabled: true,
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
      .patch('/v1/players/auth/toggle_verification')
      .send({ currentPassword: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', 'fake-session')
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
