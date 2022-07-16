import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import clearEntities from '../../utils/clearEntities'

describe('Leaderboard service - delete', () => {
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
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const res = await request(app.callback())
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_DELETED
    })

    if (statusCode === 204) {
      expect(activity.extra.leaderboardInternalName).toBe(leaderboard.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete leaderboards' })

      expect(activity).toBeNull()
    }
  })

  it('should not delete a leaderboard for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([leaderboard])

    const res = await request(app.callback())
      .delete(`/games/${otherGame.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
      .delete(`/games/${game.id}/leaderboards/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
