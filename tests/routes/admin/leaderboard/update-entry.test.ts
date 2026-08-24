import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Leaderboard admin API - update entry', () => {
  it("should update a leaderboard entry's score for a key with the write:leaderboards scope", async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players)
      .state(() => ({ score: 100 }))
      .one()
    await em.persist(entry).flush()

    const res = await request(app)
      .patch(`/admin/v1/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ newScore: 200 })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.score).toBe(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_UPDATED,
      game: apiKey.game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        entryId: entry.id,
        display: {
          Player: entry.playerAlias.player.id,
          Leaderboard: entry.leaderboard.internalName,
          'Old score': 100,
          'New score': 200,
        },
      },
    })

    expect(activity).not.toBeNull()
  })

  it('should mark a leaderboard entry as hidden', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).one()
    await em.persist(entry).flush()

    const res = await request(app)
      .patch(`/admin/v1/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_HIDDEN,
      game: apiKey.game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        entryId: entry.id,
        display: {
          Player: entry.playerAlias.player.id,
          Score: entry.score,
        },
      },
    })

    expect(activity).not.toBeNull()
  })

  it('should return 404 for a non-existent entry', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

    const res = await request(app)
      .patch(`/admin/v1/leaderboards/${leaderboard.id}/entries/12312321`)
      .send({ hidden: true })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard entry not found' })
  })

  it('should return 404 for a non-existent leaderboard', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_LEADERBOARDS])

    const res = await request(app)
      .patch('/admin/v1/leaderboards/21312312/entries/1')
      .send({ hidden: true })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body.message).toBe('Leaderboard not found')
  })

  it('should return 403 for a key missing the write:leaderboards scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).one()
    await em.persist(entry).flush()

    const res = await request(app)
      .patch(`/admin/v1/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:leaderboards')
  })
})
