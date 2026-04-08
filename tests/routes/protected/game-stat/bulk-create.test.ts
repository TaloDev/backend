import request from 'supertest'
import { vi } from 'vitest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import GameStat from '../../../../src/entities/game-stat'
import { UserType } from '../../../../src/entities/user'
import * as createModule from '../../../../src/routes/protected/game-stat/create'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

function statPayload(overrides?: Partial<GameStat>) {
  return {
    internalName: 'levels-completed',
    name: 'Levels completed',
    defaultValue: 0,
    global: false,
    minTimeBetweenUpdates: 0,
    minValue: -10,
    maxValue: 10,
    maxChange: 1,
    ...overrides,
  }
}

describe('Game stat - bulk create', () => {
  it.each(userPermissionProvider([UserType.ADMIN, UserType.DEV]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const res = await request(app)
        .post(`/games/${game.id}/game-stats/bulk`)
        .send({ stats: [statPayload()] })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.stats).toHaveLength(1)
        expect(res.body.stats[0].internalName).toBe('levels-completed')
        expect(res.body.errors).toStrictEqual([[]])
      } else {
        expect(res.body).toStrictEqual({ message: 'You do not have permissions to create stats' })
      }
    },
  )

  it('should bulk create multiple stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-stats/bulk`)
      .send({
        stats: [
          statPayload({ internalName: 'stat-one', name: 'Stat One' }),
          statPayload({ internalName: 'stat-two', name: 'Stat Two', global: true }),
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(2)
    expect(res.body.stats[0].internalName).toBe('stat-one')
    expect(res.body.stats[1].internalName).toBe('stat-two')
    expect(res.body.errors).toStrictEqual([[], []])

    const activities = await em.repo(GameActivity).find({
      type: GameActivityType.GAME_STAT_CREATED,
      game,
    })
    expect(activities).toHaveLength(2)
  })

  it('should partially succeed and collect errors for duplicate internalNames', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const existing = await new GameStatFactory([game])
      .state(() => ({ internalName: 'existing-stat' }))
      .one()
    await em.persist(existing).flush()

    const res = await request(app)
      .post(`/games/${game.id}/game-stats/bulk`)
      .send({
        stats: [
          statPayload({ internalName: 'new-stat', name: 'New Stat' }),
          statPayload({ internalName: 'existing-stat', name: 'Existing Stat' }),
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(1)
    expect(res.body.stats[0].internalName).toBe('new-stat')
    expect(res.body.errors[0]).toStrictEqual([])
    expect(res.body.errors[1]).toStrictEqual([
      "A stat with the internalName 'existing-stat' already exists",
    ])
  })

  it('should not create stats for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .post(`/games/${otherGame.id}/game-stats/bulk`)
      .send({ stats: [statPayload()] })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create stats for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    await request(app)
      .post('/games/99999/game-stats/bulk')
      .send({ stats: [statPayload()] })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should continue processing remaining stats after a handler error', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-stats/bulk`)
      .send({
        stats: [
          statPayload({
            internalName: 'stat-one',
            name: 'Stat One',
            minTimeBetweenUpdates: 999_999_999_999_999,
          }),
          statPayload({ internalName: 'stat-two', name: 'Stat Two' }),
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(1)
    expect(res.body.stats[0].internalName).toBe('stat-two')
    expect(res.body.errors[0]).toStrictEqual(['Value is out of range'])
    expect(res.body.errors[1]).toStrictEqual([])
  })

  it('should continue processing remaining stats after an unexpected error', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    vi.spyOn(createModule, 'createStatHandler').mockRejectedValueOnce(
      new Error('Unexpected failure'),
    )

    const res = await request(app)
      .post(`/games/${game.id}/game-stats/bulk`)
      .send({
        stats: [
          statPayload({ internalName: 'stat-one', name: 'Stat One' }),
          statPayload({ internalName: 'stat-two', name: 'Stat Two' }),
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(1)
    expect(res.body.stats[0].internalName).toBe('stat-two')
    expect(res.body.errors[0]).toStrictEqual(['Unexpected failure'])
    expect(res.body.errors[1]).toStrictEqual([])
  })

  it('should not accept an empty stats array', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .post(`/games/${game.id}/game-stats/bulk`)
      .send({ stats: [] })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
