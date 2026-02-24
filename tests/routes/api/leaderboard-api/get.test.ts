import { addDays } from 'date-fns'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Leaderboard API - get', () => {
  it('should get leaderboard entries if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    const hiddenEntries = await new LeaderboardEntryFactory(leaderboard, players).hidden().many(3)

    await em.persist([...players, ...entries, ...hiddenEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)

    if (leaderboard.sortMode === LeaderboardSortMode.ASC) {
      expect(res.body.entries[0].score).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].score,
      )
      expect(res.body.entries[0].position).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].position,
      )
    } else {
      expect(res.body.entries[0].score).toBeGreaterThanOrEqual(
        res.body.entries[res.body.entries.length - 1].score,
      )
      expect(res.body.entries[0].position).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].position,
      )
    }
  })

  it('should get leaderboard entries for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ playerAlias: player.aliases[0] }))
      .many(2)

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await em.persist([player, ...entries, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)

    if (leaderboard.sortMode === LeaderboardSortMode.ASC) {
      expect(res.body.entries[0].score).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].score,
      )
      expect(res.body.entries[0].position).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].position,
      )
    } else {
      expect(res.body.entries[0].score).toBeGreaterThanOrEqual(
        res.body.entries[res.body.entries.length - 1].score,
      )
      expect(res.body.entries[0].position).toBeLessThanOrEqual(
        res.body.entries[res.body.entries.length - 1].position,
      )
    }
  })

  it('should not get leaderboard entries if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persist(leaderboard).flush()

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
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.ASC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 400,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 300 }))
      .many(5)

    await em.persist([player, entry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries[0].position).toBe(5)
  })

  it('should correctly calculate positions in a descending leaderboard for a specific alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 200,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 300 }))
      .many(5)

    await em.persist([player, entry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries[0].position).toBe(5)
  })

  it('should correctly calculate position 0 for the top float score in a desc leaderboard when filtering by player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayers = await new PlayerFactory([apiKey.game]).many(2)

    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC, unique: false }))
      .one()

    // player has the highest score so should be at position 0
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 37.441001892089844,
        playerAlias: player.aliases[0],
      }))
      .one()

    const lowerScoringEntry1 = await new LeaderboardEntryFactory(leaderboard, [otherPlayers[0]])
      .state(() => ({ score: 20.45199966430664 }))
      .one()

    const lowerScoringEntry2 = await new LeaderboardEntryFactory(leaderboard, [otherPlayers[1]])
      .state(() => ({ score: 21.559999465942383 }))
      .one()

    await em
      .persist([player, entry, ...otherPlayers, lowerScoringEntry1, lowerScoringEntry2])
      .flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].position).toBe(0)
  })

  it('should correctly calculate last place for the highest float score in an asc leaderboard when filtering by player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayers = await new PlayerFactory([apiKey.game]).many(2)

    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.ASC, unique: false }))
      .one()

    // player has the highest score so should be in last place (position 2)
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 37.441001892089844,
        playerAlias: player.aliases[0],
      }))
      .one()

    const lowerScoringEntry1 = await new LeaderboardEntryFactory(leaderboard, [otherPlayers[0]])
      .state(() => ({ score: 20.45199966430664 }))
      .one()

    const lowerScoringEntry2 = await new LeaderboardEntryFactory(leaderboard, [otherPlayers[1]])
      .state(() => ({ score: 21.559999465942383 }))
      .one()

    await em
      .persist([player, entry, ...otherPlayers, lowerScoringEntry1, lowerScoringEntry2])
      .flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ aliasId: player.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].position).toBe(2)
  })

  it('should return a consistent position for scores when filtering by player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()

    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC, unique: false }))
      .one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 8,
        playerAlias: player.aliases[0],
        createdAt: new Date(),
      }))
      .one()
    const otherEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer])
      .state(() => ({
        score: 8,
        createdAt: addDays(new Date(), 1),
      }))
      .one()
    const irrelevantEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer])
      .state(() => ({
        score: 1,
        createdAt: new Date(),
      }))
      .one()

    await em.persist([entry, otherEntry, irrelevantEntry]).flush()

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
    expect(filteredRes.body.entries[0].playerAlias.id).toBe(
      globalRes.body.entries[0].playerAlias.id,
    )
    expect(filteredRes.body.entries[0].position).toBe(globalRes.body.entries[0].position)
  })

  it('should get leaderboard entries for a specific player using playerId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ playerAlias: player.aliases[0] }))
      .many(2)

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await em.persist([player, ...entries, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ playerId: player.id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entries.length)
    expect(
      res.body.entries.every(
        (e: { playerAlias: { id: number } }) => e.playerAlias.id === player.aliases[0].id,
      ),
    ).toBe(true)
  })

  it('should correctly calculate positions when filtering by playerId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 200,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 300 }))
      .many(3)

    await em.persist([player, entry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ playerId: player.id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].position).toBe(3)
  })

  it('should get leaderboard entries filtered by both playerId and aliasId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const alias = player.aliases[0]
    const entriesForAlias = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ playerAlias: alias }))
      .many(2)

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await em.persist([player, ...entriesForAlias, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ playerId: player.id, aliasId: alias.id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(entriesForAlias.length)
    expect(
      res.body.entries.every((e: { playerAlias: { id: number } }) => e.playerAlias.id === alias.id),
    ).toBe(true)
  })

  it('should not return entries for an aliasId that does not belong to the playerId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()

    const entries = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ playerAlias: player.aliases[0] }))
      .many(2)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, [otherPlayer])
      .state(() => ({ playerAlias: otherPlayer.aliases[0] }))
      .many(2)

    await em.persist([player, ...entries, otherPlayer, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ playerId: player.id, aliasId: otherPlayer.aliases[0].id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(0)
  })

  it('should not return dev build entries when filtering by playerId', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const devEntries = await new LeaderboardEntryFactory(leaderboard, [devPlayer])
      .state(() => ({ playerAlias: devPlayer.aliases[0] }))
      .many(2)

    const normalPlayer = await new PlayerFactory([apiKey.game]).one()
    const normalEntries = await new LeaderboardEntryFactory(leaderboard, [normalPlayer])
      .state(() => ({ playerAlias: normalPlayer.aliases[0] }))
      .many(2)

    await em.persist([devPlayer, ...devEntries, normalPlayer, ...normalEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ playerId: devPlayer.id, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(0)
  })
})
