import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Player service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .delete(`/games/${game.id}/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.PLAYER_DELETED,
      extra: {
        playerId: player.id
      }
    })

    const deletedPlayer = await em.refresh(player)
    if (statusCode === 204) {
      expect(activity).not.toBeNull()
      expect(deletedPlayer).toBeNull()
    } else {
      expect(res.body).toStrictEqual({
        message: 'You do not have permissions to delete players'
      })

      expect(activity).toBeNull()
      expect(deletedPlayer).not.toBeNull()
    }
  })

  it('should return 404 for non-existent player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/players/non-existent-id`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not allow users to delete players from other games', async () => {
    const [, game] = await createOrganisationAndGame()
    const [otherToken] = await createUserAndToken({ type: UserType.ADMIN })

    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .delete(`/games/${game.id}/players/${player.id}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(403)
  })
})
