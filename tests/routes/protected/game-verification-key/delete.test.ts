import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import GameVerificationKeyFactory from '../../../fixtures/GameVerificationKeyFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Game verification key - delete', () => {
  it('should delete a verification key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.ADMIN, emailConfirmed: true },
      organisation,
    )

    const key = await new GameVerificationKeyFactory(game).version('1').value('secret').one()
    await em.persist(key).flush()

    await request(app)
      .delete(`/games/${game.id}/verification-keys/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const deleted = await em.refresh(key)
    expect(deleted).toBeNull()

    expect(
      await em.repo(GameActivity).find({
        game,
        type: GameActivityType.VERIFICATION_KEY_DELETED,
        extra: {
          version: '1',
        },
      }),
    ).toHaveLength(1)
  })

  it('should return 404 for a non-existent key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.ADMIN, emailConfirmed: true },
      organisation,
    )

    await request(app)
      .delete(`/games/${game.id}/verification-keys/9999`)
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should return 403 for dev users', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.DEV }, organisation)

    await request(app)
      .delete(`/games/${game.id}/verification-keys/1`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
