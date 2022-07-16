import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import clearEntities from '../../utils/clearEntities'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('API key service - post', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameActivity'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`/games/${game.id}/api-keys`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.apiKey.gameId).toBe(game.id)
      expect(res.body.apiKey.scopes).toStrictEqual(['read:players', 'write:events'])
    }

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_CREATED,
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
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
      .post(`/games/${game.id}/api-keys`)
      .send({ scopes: ['read:players', 'write:events'] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to create API keys' })
  })

  it('should not create an api key for a non-existent game', async () => {
    const [token] = await createUserAndToken(app.context.em, { emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app.callback())
      .post('/games/99999/api-keys')
      .send({ scopes: [] })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create an api key for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { emailConfirmed: true, type: UserType.ADMIN })

    const res = await request(app.callback())
      .post(`/games/${otherGame.id}/api-keys`)
      .send({ scopes: [] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
