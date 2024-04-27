import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Player group service - delete', () => {
  it.each(userPermissionProvider([
    UserType.DEV,
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await (<EntityManager>global.em).persistAndFlush(group)

    const res = await request(global.app)
      .delete(`/games/${game.id}/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_GROUP_DELETED,
      game
    })

    if (statusCode === 204) {
      expect(activity.extra.groupName).toBe(group.name)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete groups' })

      expect(activity).toBeNull()
    }
  })

  it('should not delete a group for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const group = await new PlayerGroupFactory().construct(otherGame).one()
    await (<EntityManager>global.em).persistAndFlush([group])

    const res = await request(global.app)
      .delete(`/games/${otherGame.id}/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(global.app)
      .delete(`/games/${game.id}/player-groups/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Group not found' })
  })
})
