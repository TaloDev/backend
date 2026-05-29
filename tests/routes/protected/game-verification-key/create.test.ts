import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import GameVerificationKeyFactory from '../../../fixtures/GameVerificationKeyFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Game verification key - create', () => {
  it('should create a verification key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .send({ version: '1', value: 'super-secret-key' })
      .expect(200)

    expect(res.body.verificationKey).toMatchObject({
      version: '1',
      value: 'super-secret-key',
    })

    expect(
      await em.repo(GameActivity).find({
        game,
        type: GameActivityType.VERIFICATION_KEY_CREATED,
      }),
    ).toHaveLength(1)
  })

  it('should return 409 for a duplicate version', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await request(app)
      .post(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .send({ version: '1', value: 'first-key' })
      .expect(200)

    await request(app)
      .post(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .send({ version: '1', value: 'second-key' })
      .expect(409)
  })

  it('should not return 409 for a duplicate version from another game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const [, otherGame] = await createOrganisationAndGame()
    const otherKey = await new GameVerificationKeyFactory(otherGame)
      .version('1')
      .value('secret')
      .one()
    await em.persist(otherKey).flush()

    await request(app)
      .post(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .send({ version: '1', value: 'second-key' })
      .expect(200)
  })

  it('should return 403 for dev users', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.DEV }, organisation)

    await request(app)
      .post(`/games/${game.id}/verification-keys`)
      .auth(token, { type: 'bearer' })
      .send({ version: '1', value: 'super-secret-key' })
      .expect(403)
  })
})
