import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import { APIKeyScope } from '../../../../src/entities/api-key'

describe('API key - post', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/api-keys`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.apiKey.gameId).toBe(game.id)
      expect(res.body.apiKey.scopes).toStrictEqual(['read:players', 'write:events'])
    }

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_CREATED,
      game,
      extra: {
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

  it('should not create an api key if the user\'s email is not confirmed', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/api-keys`)
      .send({ scopes: [APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_EVENTS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to create API keys' })
  })

  it('should not create an api key for a non-existent game', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app)
      .post('/games/99999/api-keys')
      .send({ scopes: [APIKeyScope.READ_PLAYERS] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create an api key for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app)
      .post(`/games/${otherGame.id}/api-keys`)
      .send({ scopes: [APIKeyScope.READ_PLAYERS] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
