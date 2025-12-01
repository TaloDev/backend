import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import { randUserName } from '@ngneat/falso'

describe('Player auth API service - register', () => {
  it('should register a player if the api key has the correct scopes', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const identifier = randUserName()

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(identifier)
    expect(res.body.alias.service).toBe('talo')

    expect(res.body.alias.player.id).toBeTruthy()
    expect(res.body.alias.player.auth).toStrictEqual({
      email: null,
      verificationEnabled: false,
      sessionCreatedAt: expect.any(String)
    })

    expect(res.body.sessionToken).toBeTruthy()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.REGISTERED,
      extra: {
        verificationEnabled: false
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not register a player if the api key does not have the correct scopes', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: randUserName(), password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should register a player with an email', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const identifier = randUserName()

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier, password: 'password', email: 'boz@mail.com' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(identifier)
    expect(res.body.alias.service).toBe('talo')

    expect(res.body.alias.player.id).toBeTruthy()
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      verificationEnabled: false,
      sessionCreatedAt: expect.any(String)
    })

    expect(res.body.sessionToken).toBeTruthy()
  })

  it('should register a player with email verification enabled', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const identifier = randUserName()

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier, password: 'password', email: 'boz@mail.com', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(identifier)
    expect(res.body.alias.service).toBe('talo')

    expect(res.body.alias.player.id).toBeTruthy()
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      verificationEnabled: true,
      sessionCreatedAt: expect.any(String)
    })

    expect(res.body.sessionToken).toBeTruthy()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.REGISTERED,
      extra: {
        verificationEnabled: true
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not register a player if verification is enabled but no email is provided', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: randUserName(), password: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        email: ['email is missing from the request body']
      }
    })
  })

  it('should not register a player if verification is enabled but the email is invalid', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: randUserName(), email: 'blah', password: 'password', verificationEnabled: true })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Invalid email address',
      errorCode: 'INVALID_EMAIL'
    })
  })

  it('should trim whitespace from identifiers before storing', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const identifier = randUserName()
    const identifierWithSpaces = `  ${identifier}  `

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: identifierWithSpaces, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(identifier)
    expect(res.body.alias.identifier).not.toBe(identifierWithSpaces)
  })
})
