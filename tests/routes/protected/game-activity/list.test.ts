import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import { DEFAULT_PAGE_SIZE } from '../../../../src/lib/pagination/itemsPerPage'
import GameActivityFactory from '../../../fixtures/GameActivityFactory'
import UserFactory from '../../../fixtures/UserFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Game activity - list', () => {
  it.each(userPermissionProvider([UserType.ADMIN, UserType.DEMO]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token, user] = await createUserAndToken({ type }, organisation)

      const activities = await new GameActivityFactory([game], [user]).many(5)
      await em.persist([user, game, ...activities]).flush()

      const res = await request(app)
        .get(`/games/${game.id}/game-activities`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.activities).toHaveLength(activities.length)
        expect(res.body.count).toBe(activities.length)
        expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
        expect(res.body.isLastPage).toBe(true)
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to view game activities',
        })
      }
    },
  )

  it('should return game activities with no games but from the same organisation', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [otherOrg] = await createOrganisationAndGame()

    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)
    const otherUser = await new UserFactory().state(() => ({ organisation: otherOrg })).one()

    const activities = await new GameActivityFactory([], [user]).many(5)
    const otherActivities = await new GameActivityFactory([], [otherUser]).many(5)

    await em.persist([...activities, ...otherActivities]).flush()

    const res = await request(app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(activities.length)
    expect(res.body.count).toBe(activities.length)
    expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should paginate game activities', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const activities = await new GameActivityFactory([game], [user]).many(DEFAULT_PAGE_SIZE + 5)
    await em.persist(activities).flush()

    const res = await request(app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(DEFAULT_PAGE_SIZE)
    expect(res.body.count).toBe(DEFAULT_PAGE_SIZE + 5)
    expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
    expect(res.body.isLastPage).toBe(false)

    const res2 = await request(app)
      .get(`/games/${game.id}/game-activities?page=1`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res2.body.activities).toHaveLength(5)
    expect(res2.body.count).toBe(DEFAULT_PAGE_SIZE + 5)
    expect(res2.body.isLastPage).toBe(true)
  })

  it('should not return a list of game activities for a game the user has no access to', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const user = await new UserFactory().state(() => ({ organisation })).one()
    const activities = await new GameActivityFactory([game], [user]).many(10)
    await em.persist(activities).flush()

    const res = await request(app)
      .get(`/games/${game.id}/game-activities`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
