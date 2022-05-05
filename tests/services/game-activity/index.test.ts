import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import GameActivityFactory from '../../fixtures/GameActivityFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'

const baseUrl = '/game-activities'

describe('Game activitie service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEMO
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token, user] = await createUserAndToken(app.context.em, { type, emailConfirmed: true }, organisation)

    const activities = await new GameActivityFactory([game], [user]).many(5)
    await (<EntityManager>app.context.em).persistAndFlush([user, game, ...activities])

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.activities).toHaveLength(activities.length)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view game activities' })
    }
  })

  it('should not return a list of game activities for a game the user has no access to', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const user = await new UserFactory().with(() => ({ organisation })).one()
    const activities = await new GameActivityFactory([game], [user]).many(10)
    await (<EntityManager>app.context.em).persistAndFlush(activities)

    const res = await request(app.callback())
      .get(`${baseUrl}`)
      .query({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
