import { subDays } from 'date-fns'
import request from 'supertest'
import EventRetention from '../../../../src/entities/event-retention.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Event retention - upsert', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const res = await request(app)
        .put(`/games/${game.id}/events/retention`)
        .send({ eventName: 'Boss defeated', retentionDays: 30 })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode !== 200) {
        return
      }

      expect(res.body.retention).toStrictEqual({
        id: expect.any(Number),
        eventName: 'Boss defeated',
        retentionDays: 30,
        updatedAt: expect.any(String),
      })

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.EVENT_RETENTION_UPDATED,
        game,
      })
      expect(activity?.extra).toMatchObject({
        eventName: 'Boss defeated',
        retentionDays: 30,
      })
    },
  )

  it('should update an existing retention config', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const retention = new EventRetention(game, 'Boss defeated', 30)
    retention.createdAt = subDays(new Date(), 5)
    retention.updatedAt = subDays(new Date(), 5)
    await em.persist(retention).flush()

    const res = await request(app)
      .put(`/games/${game.id}/events/retention`)
      .send({ eventName: 'Boss defeated', retentionDays: 7 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.retention).toMatchObject({
      eventName: 'Boss defeated',
      retentionDays: 7,
    })
    expect(await em.repo(EventRetention).count({ game })).toBe(1)

    const updatedAtBefore = retention.updatedAt.getTime()
    const stored = await em.refreshOrFail(retention)
    expect(stored.createdAt.toISOString()).toBe(retention.createdAt.toISOString())
    expect(stored.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore)
  })

  it('should reject invalid retention days', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/events/retention`)
      .send({ eventName: 'Boss defeated', retentionDays: 0 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        retentionDays: ['Too small: expected number to be >=1'],
      },
    })
  })

  it('should reject retention days over the max', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/events/retention`)
      .send({ eventName: 'Boss defeated', retentionDays: 36501 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        retentionDays: ['Too big: expected number to be <=36500'],
      },
    })
  })
})
