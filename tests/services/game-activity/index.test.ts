import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import GameActivityFactory from '../../fixtures/GameActivityFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'

describe('Game activity service - index', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEMO
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type }, organisation)

    const activities = await new GameActivityFactory([game], [user]).many(5)
    await (<EntityManager>global.em).persistAndFlush([user, game, ...activities])

    const res = await request(global.app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.activities).toHaveLength(activities.length)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view game activities' })
    }
  })

  it('should return game activities with no games but from the same organisation', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [otherOrg] = await createOrganisationAndGame()

    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)
    const otherUser = await new UserFactory().with(() => ({ organisation: otherOrg })).one()

    const activities = await new GameActivityFactory([], [user]).many(5)
    const otherActivities = await new GameActivityFactory([], [otherUser]).many(5)

    await (<EntityManager>global.em).persistAndFlush([...activities, ...otherActivities])

    const res = await request(global.app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(activities.length)
  })

  it('should not return a list of game activities for a game the user has no access to', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const user = await new UserFactory().with(() => ({ organisation })).one()
    const activities = await new GameActivityFactory([game], [user]).many(10)
    await (<EntityManager>global.em).persistAndFlush(activities)

    const res = await request(global.app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
