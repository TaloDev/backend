import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import { addDays } from 'date-fns'

describe('Leaderboard API service - get', () => {
  it('should get leaderboard entries if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    const hiddenEntries = await new LeaderboardEntryFactory(leaderboard, players).hidden().many(3)

    await em.persistAndFlush([...players, ...entries, ...hiddenEntries])

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)

    if (leaderboard.sortMode === LeaderboardSortMode.ASC) {
      expect(res.body.entries[0].score).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].score)
      expect(res.body.entries[0].position).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].position)
    } else {
      expect(res.body.entries[0].score).toBeGreaterThanOrEqual(res.body.entries[res.body.entries.length - 1].score)
      expect(res.body.entries[0].position).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].position)
    }
  })

  it('should get leaderboard entries for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ playerAlias: player.aliases[0] })).many(2)

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await em.persistAndFlush([player, ...entries, ...otherPlayers, ...otherEntries])

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)

    if (leaderboard.sortMode === LeaderboardSortMode.ASC) {
      expect(res.body.entries[0].score).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].score)
      expect(res.body.entries[0].position).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].position)
    } else {
      expect(res.body.entries[0].score).toBeGreaterThanOrEqual(res.body.entries[res.body.entries.length - 1].score)
      expect(res.body.entries[0].position).toBeLessThanOrEqual(res.body.entries[res.body.entries.length - 1].position)
    }
  })

  it('should not get leaderboard entries if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persistAndFlush(leaderboard)

    await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get entries for a non-existent leaderboard', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    await request(app)
      .get('/v1/leaderboards/blah/entries')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should correctly calculate positions in an ascending leaderboard for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ sortMode: LeaderboardSortMode.ASC })).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({
      playerAlias: player.aliases[0],
      score: 400
    })).one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).state(() => ({ score: 300 })).many(5)

    await em.persistAndFlush([player, entry, ...otherPlayers, ...otherEntries])

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries[0].position).toBe(5)
  })

  it('should correctly calculate positions in a descending leaderboard for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ sortMode: LeaderboardSortMode.DESC })).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({
      playerAlias: player.aliases[0],
      score: 200
    })).one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).state(() => ({ score: 300 })).many(5)

    await em.persistAndFlush([player, entry, ...otherPlayers, ...otherEntries])

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries[0].position).toBe(5)
  })

  it('should return a consistent position for scores when filtering by player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()

    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ sortMode: LeaderboardSortMode.DESC, unique: false })).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({
      score: 8,
      playerAlias: player.aliases[0],
      createdAt: new Date()
    })).one()
    const otherEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer]).state(() => ({
      score: 8,
      createdAt: addDays(new Date(), 1)
    })).one()
    const irrelevantEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer]).state(() => ({
      score: 1,
      createdAt: new Date()
    })).one()

    await em.persistAndFlush([entry, otherEntry, irrelevantEntry])

    const filteredRes = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const globalRes = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(filteredRes.body.entries[0].id).toBe(globalRes.body.entries[0].id)
    expect(filteredRes.body.entries[0].playerAlias.id).toBe(globalRes.body.entries[0].playerAlias.id)
    expect(filteredRes.body.entries[0].position).toBe(globalRes.body.entries[0].position)
  })
})
