import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createUserAndToken from '../../../utils/createUserAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import { UserType } from '../../../../src/entities/user'
import PlayerAuthActivityFactory from '../../../fixtures/PlayerAuthActivityFactory'
import { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import { DEFAULT_PAGE_SIZE } from '../../../../src/lib/pagination/itemsPerPage'

describe('Player - get auth activities', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const player = await new PlayerFactory([game]).withTaloAlias().one()
    const activities = await new PlayerAuthActivityFactory(game).state(() => ({ player })).many(10)

    await em.persist(activities).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.activities).toHaveLength(10)
      expect(res.body.count).toBe(10)
      expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
      expect(res.body.isLastPage).toBe(true)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view player auth activities' })
    }
  })

  it('should not get a player\'s auth activities for a player they have no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const player = await new PlayerFactory([game]).one()

    await em.persist(player).flush()

    await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get a player\'s auth activities if they do not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/players/21312321321/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return a player\'s auth activities if they do not have a talo alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).withUsernameAlias().one()
    const activities = await new PlayerAuthActivityFactory(game).state(() => ({ player })).many(10)

    await em.persist(activities).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(0)
    expect(res.body.count).toBe(0)
    expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should paginate auth activities', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).withTaloAlias().one()
    const activities = await new PlayerAuthActivityFactory(game).state(() => ({ player })).many(DEFAULT_PAGE_SIZE + 5)

    await em.persist(activities).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.activities).toHaveLength(DEFAULT_PAGE_SIZE)
    expect(res.body.count).toBe(DEFAULT_PAGE_SIZE + 5)
    expect(res.body.itemsPerPage).toBe(DEFAULT_PAGE_SIZE)
    expect(res.body.isLastPage).toBe(false)

    const res2 = await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities?page=1`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res2.body.activities).toHaveLength(5)
    expect(res2.body.count).toBe(DEFAULT_PAGE_SIZE + 5)
    expect(res2.body.isLastPage).toBe(true)
  })

  it('should return contextual activity descriptions', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).withTaloAlias().one()
    const activity = await new PlayerAuthActivityFactory(game).state(() => ({
      player,
      type: PlayerAuthActivityType.REGISTERED
    })).one()

    await em.persist(activity).flush()

    const res = await request(app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const identifier = player.aliases[0].identifier

    expect(res.body.activities[0]).toStrictEqual({
      id: activity.id,
      type: activity.type,
      description: `${identifier} created their account`,
      extra: expect.any(Object),
      createdAt: expect.any(String)
    })
  })
})
