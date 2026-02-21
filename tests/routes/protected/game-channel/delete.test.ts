import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import { UserType } from '../../../../src/entities/user'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Game channel - delete', () => {
  it.each(userPermissionProvider([UserType.ADMIN], 204))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const channel = await new GameChannelFactory(game).one()
      await em.persistAndFlush(channel)

      const res = await request(app)
        .delete(`/games/${game.id}/game-channels/${channel.id}`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const activity = await em.getRepository(GameActivity).findOne({
        type: GameActivityType.GAME_CHANNEL_DELETED,
        game,
      })

      if (statusCode === 204) {
        expect(activity!.extra.channelName).toBe(channel.name)
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to delete game channels',
        })
        expect(activity).toBeNull()
      }
    },
  )

  it('should not delete a game channel the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const channel = await new GameChannelFactory(game).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .delete(`/games/${game.id}/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a game channel for a non-existent game', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const channel = await new GameChannelFactory(game).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .delete(`/games/99999/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not delete a non-existent game channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/game-channels/99999`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })
})
