import request from 'supertest'
import EventRetention from '../../../../src/entities/event-retention.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Event retention - delete', () => {
  it.each(userPermissionProvider([UserType.ADMIN], 204))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await em.persist(new EventRetention(game, 'Boss defeated', 30)).flush()

      await request(app)
        .delete(`/games/${game.id}/events/retention`)
        .query({ eventName: 'Boss defeated' })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      expect(await em.repo(EventRetention).count({ game })).toBe(statusCode === 204 ? 0 : 1)

      if (statusCode !== 204) {
        return
      }

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.EVENT_RETENTION_DELETED,
        game,
      })
      expect(activity?.extra).toMatchObject({ eventName: 'Boss defeated' })
    },
  )

  it("should not delete another game's retention config", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await em.persist(new EventRetention(otherGame, 'Boss defeated', 30)).flush()

    await request(app)
      .delete(`/games/${game.id}/events/retention`)
      .query({ eventName: 'Boss defeated' })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.repo(EventRetention).count({ game: otherGame })).toBe(1)
  })
})
