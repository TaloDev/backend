import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import APIKey from '../../../src/entities/api-key'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

const baseUrl = '/api-keys'

describe('API keys service - delete', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should delete an api key', async () => {
    const key = new APIKey(validGame, user)
    await (<EntityManager>app.context.em).persistAndFlush(key)

    await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    await (<EntityManager>app.context.em).clear()
    const updatedKey = await (<EntityManager>app.context.em).getRepository(APIKey).findOne(key.id)

    expect(updatedKey.revokedAt).toBeTruthy()

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_REVOKED,
      extra: {
        keyId: key.id
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not delete an api key that doesn\'t exist', async () => {
    const res = await request(app.callback())
      .delete(`${baseUrl}/99`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'API key not found' })
  })

  it('should not delete an api key for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const invalidUser = await new UserFactory().one()
    const key = new APIKey(new Game('Crawle', otherOrg), invalidUser)
    await (<EntityManager>app.context.em).persistAndFlush(key)

    await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
