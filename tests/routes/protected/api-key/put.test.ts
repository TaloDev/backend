import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'

describe('API key  - put', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

    const key = new APIKey(game, user)
    await em.persist(key).flush()

    const res = await request(app)
      .put(`/games/${game.id}/api-keys/${key.id}`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.apiKey.gameId).toBe(game.id)
      expect(res.body.apiKey.scopes).toStrictEqual(['read:players', 'write:events'])
    }

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_UPDATED,
      game,
      extra: {
        keyId: key.id,
        display: {
          'Scopes': 'read:players, write:events'
        }
      }
    })

    if (statusCode === 200) {
      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should not update an api key if the user\'s email is not confirmed', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const key = new APIKey(game, user)
    await em.persist(key).flush()

    const res = await request(app)
      .put(`/games/${game.id}/api-keys/${key.id}`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to update API keys' })
  })

  it('should not update an api key for a non-existent game', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const key = new APIKey(game, user)
    await em.persist(key).flush()

    const res = await request(app)
      .put(`/games/99999/api-keys/${key.id}`)
      .send({ scopes: [] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not update an api key for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const key = new APIKey(otherGame, user)
    await em.persist(key).flush()

    const res = await request(app)
      .put(`/games/${otherGame.id}/api-keys/${key.id}`)
      .send({ scopes: [APIKeyScope.READ_PLAYERS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update an api key that does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/api-keys/99999`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'API key not found' })
  })
})
