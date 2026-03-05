import bcrypt from 'bcrypt'
import request from 'supertest'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('Player public - verify', () => {
  it('should login a player if the verification code is correct', async () => {
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

    await redis.set(`player-auth:${game.id}:verification:${alias.id}`, '123456')

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/verify`)
      .send({ aliasId: alias.id, code: '123456' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(alias.identifier)
    expect(res.body.alias.player.auth).toStrictEqual({
      email: 'boz@mail.com',
      sessionCreatedAt: null,
      verificationEnabled: true,
    })
    expect(res.body.sessionToken).toBeTruthy()

    expect(await redis.get(`player-auth:${game.id}:verification:${alias.id}`)).toBeNull()
  })

  it('should return 404 for an invalid game token', async () => {
    await request(app)
      .post('/public/players/badtoken/verify')
      .send({ aliasId: 1, code: '123456' })
      .expect(404)
  })

  it('should return 403 if the alias does not exist', async () => {
    const [, game] = await createOrganisationAndGame()

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/verify`)
      .send({ aliasId: Number.MAX_SAFE_INTEGER, code: '123456' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Player alias not found',
      errorCode: 'VERIFICATION_ALIAS_NOT_FOUND',
    })
  })

  it('should return 403 if the verification code is incorrect', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: true,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    await redis.set(`player-auth:${game.id}:verification:${alias.id}`, '123456')

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/verify`)
      .send({ aliasId: alias.id, code: '111111' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Invalid code',
      errorCode: 'VERIFICATION_CODE_INVALID',
    })

    expect(await redis.get(`player-auth:${game.id}:verification:${alias.id}`)).toBe('123456')

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.VERIFICATION_FAILED,
      player: player.id,
    })
    expect(activity).not.toBeNull()
  })

  it('should return 400 if the player does not have authentication', async () => {
    const [, game] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const alias = player.aliases[0]

    const res = await request(app)
      .post(`/public/players/${game.getToken()}/verify`)
      .send({ aliasId: alias.id, code: '123456' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })

  it('should not verify an alias from a different game', async () => {
    const [, game1] = await createOrganisationAndGame()
    const [, game2] = await createOrganisationAndGame()

    const player = await new PlayerFactory([game1])
      .withTaloAlias()
      .state(async () => ({
        auth: await new PlayerAuthFactory()
          .state(async () => ({
            password: await bcrypt.hash('password', 10),
            verificationEnabled: true,
          }))
          .one(),
      }))
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    await redis.set(`player-auth:${game1.id}:verification:${alias.id}`, '123456')

    const res = await request(app)
      .post(`/public/players/${game2.getToken()}/verify`)
      .send({ aliasId: alias.id, code: '123456' })
      .expect(403)

    expect(res.body.errorCode).toBe('VERIFICATION_ALIAS_NOT_FOUND')
  })
})
