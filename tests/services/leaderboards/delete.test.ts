import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import GameFactory from '../../fixtures/GameFactory'
import Game from '../../../src/entities/game'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

const baseUrl = '/leaderboards'

describe('Leaderboards service - delete', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    validGame = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should delete a leaderboard', async () => {
    const leaderboard = await new LeaderboardFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    await request(app.callback())
      .delete(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id })
      .auth(token, { type: 'bearer' })
      .expect(204)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_DELETED,
      extra: {
        leaderboardInternalName: leaderboard.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not delete a leaderboard for demo users', async () => {
    const invalidUser = await new UserFactory().state('demo').with(() => ({ organisation: validGame.organisation })).one()
    const leaderboard = await new LeaderboardFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([invalidUser, leaderboard])

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete leaderboards' })
  })

  it('should not delete a leaderboard for dev users', async () => {
    const invalidUser = await new UserFactory().with(() => ({ organisation: validGame.organisation })).one()
    const leaderboard = await new LeaderboardFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([invalidUser, leaderboard])

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: validGame.id })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete leaderboards' })
  })

  it('should not delete a leaderboard for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([otherOrg, otherGame, leaderboard])

    await request(app.callback())
      .delete(`${baseUrl}/${leaderboard.internalName}`)
      .send({ gameId: otherGame.id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not delete a non-existent leaderboard', async () => {
    const res = await request(app.callback())
      .delete(`${baseUrl}/blah`)
      .send({ gameId: 99 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
