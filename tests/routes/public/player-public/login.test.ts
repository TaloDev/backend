import bcrypt from 'bcrypt'
import request from 'supertest'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('Player public - login', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should login a player with valid credentials', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
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
    await em.persist(player).flush()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/login`)
      .send({ identifier: alias.identifier, password: 'password' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(alias.identifier)
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      sessionCreatedAt: null,
      verificationEnabled: false,
    })
    expect(res.body.sessionToken).toBeTruthy()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.LOGGED_IN,
      player: player.id,
      extra: {
        selfService: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should return 401 for an incorrect password', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/login`)
      .send({ identifier: alias.identifier, password: 'wrongpassword' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Incorrect identifier or password',
      errorCode: 'INVALID_CREDENTIALS',
    })
  })

  it('should return 401 for an unknown identifier', async () => {
    const [, game] = await createOrganisationAndGame()
    await em.persist(game).flush()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/login`)
      .send({ identifier: 'nobody', password: 'password' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'Incorrect identifier or password',
      errorCode: 'INVALID_CREDENTIALS',
    })
  })

  it('should return 404 for an invalid game token', async () => {
    await request(app)
      .post('/public/players/invalidtoken/login')
      .send({ identifier: 'someone', password: 'password' })
      .expect(404)
  })

  it('should send a verification code if verification is enabled', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
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
    await em.persist(player).flush()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/login`)
      .send({ identifier: alias.identifier, password: 'password' })
      .expect(200)

    expect(res.body).toStrictEqual({
      aliasId: alias.id,
      verificationRequired: true,
    })

    expect(await redis.get(`player-auth:${game.id}:verification:${alias.id}`)).toHaveLength(6)
    expect(sendMock).toHaveBeenCalledOnce()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_STARTED,
      player: player.id,
      extra: {
        selfService: true,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should trim identifiers with whitespace', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/login`)
      .send({ identifier: `  ${alias.identifier}  `, password: 'password' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(alias.identifier)
    expect(res.body.sessionToken).toBeTruthy()
  })

  it('should not login a player from a different game', async () => {
    const [, game1] = await createOrganisationAndGame()
    const [, game2] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game1])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: false,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const res = await request(app)
      .post(`/public/players/${game2.getToken()}/login`)
      .send({ identifier: alias.identifier, password: 'password' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS')
  })
})
