import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'

describe('Leaderboard service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_DELETED,
      game
    })

    if (statusCode === 204) {
      expect(activity!.extra.leaderboardInternalName).toBe(leaderboard.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete leaderboards' })

      expect(activity).toBeNull()
    }
  })

  it('should not delete a leaderboard for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await em.persistAndFlush([leaderboard])

    const res = await request(app)
      .delete(`/games/${otherGame.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
