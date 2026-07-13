import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Admin API key - update', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token, user] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const { apiKey: key } = await createAdminAPIKey([], { game, user })

      const res = await request(app)
        .put(`/games/${game.id}/admin-api-keys/${key.id}`)
        .send({ scopes: ['read:stats', 'write:stats'] })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.apiKey.gameId).toBe(game.id)
        expect(res.body.apiKey.scopes).toStrictEqual(['read:stats', 'write:stats'])
      }

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.ADMIN_API_KEY_UPDATED,
        game,
        extra: {
          keyId: key.id,
          display: {
            Scopes: 'read:stats, write:stats',
          },
        },
      })

      if (statusCode === 200) {
        expect(activity).not.toBeNull()
      } else {
        expect(activity).toBeNull()
      }
    },
  )

  it("should not update an admin api key if the user's email is not confirmed", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const { apiKey: key } = await createAdminAPIKey([], { game, user })

    const res = await request(app)
      .put(`/games/${game.id}/admin-api-keys/${key.id}`)
      .send({ scopes: ['read:stats', 'write:stats'] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You need to confirm your email address to update admin API keys',
    })
  })

  it('should not update an admin api key for a non-existent game', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const { apiKey: key } = await createAdminAPIKey([], { game, user })

    const res = await request(app)
      .put(`/games/99999/admin-api-keys/${key.id}`)
      .send({ scopes: [] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not update an admin api key for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const { apiKey: key } = await createAdminAPIKey([], { game: otherGame, user })

    const res = await request(app)
      .put(`/games/${otherGame.id}/admin-api-keys/${key.id}`)
      .send({ scopes: [AdminAPIKeyScope.READ_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update an admin api key that does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken(
      { emailConfirmed: true, type: UserType.ADMIN },
      organisation,
    )

    const res = await request(app)
      .put(`/games/${game.id}/admin-api-keys/99999`)
      .send({ scopes: ['read:stats', 'write:stats'] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Admin API key not found' })
  })
})
