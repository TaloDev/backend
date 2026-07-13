import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import UserFactory from '../../../fixtures/UserFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Admin API key - revoke', () => {
  it.each(userPermissionProvider([UserType.ADMIN], 204))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token, user] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const { apiKey: key } = await createAdminAPIKey([], { game, user })

      const res = await request(app)
        .delete(`/games/${game.id}/admin-api-keys/${key.id}`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      await em.refresh(key)

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.ADMIN_API_KEY_REVOKED,
        game,
        extra: { keyId: key.id },
      })

      if (statusCode === 204) {
        expect(key.revokedAt).toBeTruthy()
        expect(activity).not.toBeNull()
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to revoke admin API keys',
        })

        expect(key.revokedAt).toBeNull()
        expect(activity).toBeNull()
      }
    },
  )

  it("should not delete an admin api key that doesn't exist", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { type: UserType.ADMIN, emailConfirmed: true },
      organisation,
    )

    const res = await request(app)
      .delete(`/games/${game.id}/admin-api-keys/99`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Admin API key not found' })
  })

  it('should not delete an admin api key for a game the user has no access to', async () => {
    const [otherOrg, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const keyUser = await new UserFactory().state(() => ({ organisation: otherOrg })).one()
    const { apiKey: key } = await createAdminAPIKey([], { game: otherGame, user: keyUser })

    const res = await request(app)
      .delete(`/games/${otherGame.id}/admin-api-keys/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You need to confirm your email address to revoke admin API keys',
    })
  })
})
