import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import { randUserName } from '@ngneat/falso'
import PlayerFactory from '../../../fixtures/PlayerFactory'

describe('Player auth API  - register', () => {
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
        email: ['email is required when verificationEnabled is true']
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

  it('should return an error if the identifier is already taken', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()
    const existingIdentifier = player.aliases[0].identifier

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: existingIdentifier, password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: `Player with identifier '${existingIdentifier}' already exists`,
      errorCode: 'IDENTIFIER_TAKEN',
      field: 'aliases'
    })
  })

  it('should return a 402 when the player limit is exceeded', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 1
    apiKey.game.organisation.pricingPlan.status = 'active'

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/auth/register')
      .send({ identifier: randUserName(), password: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body.message).toBe('Limit reached')
  })
})
