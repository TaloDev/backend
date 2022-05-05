import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import APIKey from '../../../src/entities/api-key'
import UserFactory from '../../fixtures/UserFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import clearEntities from '../../utils/clearEntities'

const baseUrl = '/api-keys'

describe('API key service - delete', () => {
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
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token, user] = await createUserAndToken(app.context.em, { type, emailConfirmed: true }, organisation)

    const key = new APIKey(game, user)
    await (<EntityManager>app.context.em).persistAndFlush(key)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    await (<EntityManager>app.context.em).clear()
    const updatedKey = await (<EntityManager>app.context.em).getRepository(APIKey).findOne(key.id)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_REVOKED,
      extra: {
        keyId: key.id
      }
    })

    if (statusCode === 204) {
      expect(updatedKey.revokedAt).toBeTruthy()
      expect(activity).not.toBeNull()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to revoke API keys' })

      expect(updatedKey.revokedAt).toBeNull()
      expect(activity).toBeNull()
    }
  })

  it('should not delete an api key that doesn\'t exist', async () => {
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true })

    const res = await request(app.callback())
      .delete(`${baseUrl}/99`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'API key not found' })
  })

  it('should not delete an api key for a game the user has no access to', async () => {
    const [otherOrg, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const user = await new UserFactory().with(() => ({ organisation: otherOrg })).one()
    const key = new APIKey(otherGame, user)
    await (<EntityManager>app.context.em).persistAndFlush(key)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
