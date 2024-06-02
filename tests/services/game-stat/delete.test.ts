import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity.js'
import GameStatFactory from '../../fixtures/GameStatFactory.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('Game stat service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(stat)

    await request(global.app)
      .delete(`/games/${game.id}/game-stats/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_DELETED,
      game,
      extra: {
        statInternalName: stat.internalName
      }
    })

    if (statusCode === 204) {
      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should not delete a stat for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const stat = await new GameStatFactory([otherGame]).one()
    await (<EntityManager>global.em).persistAndFlush(stat)

    const res = await request(global.app)
      .delete(`/games/${otherGame.id}/game-stats/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(global.app)
      .delete(`/games/${game.id}/game-stats/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
