import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Admin API key - create', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const res = await request(app)
        .post(`/games/${game.id}/admin-api-keys`)
        .send({ scopes: ['read:stats', 'write:stats'] })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.apiKey.gameId).toBe(game.id)
        expect(res.body.apiKey.scopes).toStrictEqual(['read:stats', 'write:stats'])
        expect(res.body.key).toMatch(/^ta_[a-f0-9]{64}$/)
        expect(res.body.apiKey.keyEnding).toBe(res.body.key.slice(-4))
      }

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.ADMIN_API_KEY_CREATED,
        game,
        extra: {
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

  it("should not create an admin api key if the user's email is not confirmed", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/admin-api-keys`)
      .send({ scopes: [AdminAPIKeyScope.READ_STATS, AdminAPIKeyScope.WRITE_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'You need to confirm your email address to create admin API keys',
    })
  })

  it('should not create an admin api key for a non-existent game', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app)
      .post('/games/99999/admin-api-keys')
      .send({ scopes: [AdminAPIKeyScope.READ_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create an admin api key for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app)
      .post(`/games/${otherGame.id}/admin-api-keys`)
      .send({ scopes: [AdminAPIKeyScope.READ_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
