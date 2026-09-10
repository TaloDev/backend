import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard.js'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Leaderboard API - top', () => {
  it('should require a limit', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await em.persist([leaderboard, player]).flush()

    await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should not return more than 200 entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await em.persist([leaderboard, player]).flush()

    await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 201 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should return the top entries up to the limit', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(5)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(5)

    await em.persist([player, ...players, ...entries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 3 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(3)
    expect(res.body.topEntries.map((e: { position: number }) => e.position)).toEqual([0, 1, 2])
    expect(res.body.playerEntries).toHaveLength(0)
  })

  it('should return the top entries in ascending order for asc leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.ASC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)

    await em.persist([player, ...players, ...entries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 3 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(3)
    expect(Number(res.body.topEntries[0].score)).toBeLessThanOrEqual(
      Number(res.body.topEntries[2].score),
    )
  })

  it('should return the top entries in descending order for desc leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)

    await em.persist([player, ...players, ...entries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 3 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(3)
    expect(Number(res.body.topEntries[0].score)).toBeGreaterThanOrEqual(
      Number(res.body.topEntries[2].score),
    )
  })

  it('should return the player entry with its global position when outside the top entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const playerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 100,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 200 }))
      .many(3)

    await em.persist([player, playerEntry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 2 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(2)
    expect(res.body.playerEntries[0].position).toBe(3)
    expect(res.body.playerEntries[0].id).toBe(playerEntry.id)
  })

  it('should return the player entry global position on asc leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.ASC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const playerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 300,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 100 }))
      .many(3)

    await em.persist([player, playerEntry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 2 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(2)
    expect(res.body.playerEntries[0].position).toBe(3)
    expect(res.body.playerEntries[0].id).toBe(playerEntry.id)
  })

  it('should return the player entry position 0 when the player is first', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const playerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 300,
      }))
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(2)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .state(() => ({ score: 100 }))
      .many(2)

    await em.persist([player, playerEntry, ...otherPlayers, ...otherEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 3 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerEntries[0].position).toBe(0)
    expect(res.body.topEntries[0].id).toBe(playerEntry.id)
  })

  it('should give tied entries inside the top entries a consistent position', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    entries.forEach((entry, idx) => {
      entry.playerAlias = players[idx].aliases[0]
      entry.score = 100
      entry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, idx))
    })

    await em.persist([...players, ...entries]).flush()

    const player = players[1]
    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 2 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries.map((e: { id: number }) => e.id)).toEqual([
      entries[0].id,
      entries[1].id,
    ])
    expect(res.body.playerEntries[0].id).toBe(entries[1].id)
    expect(res.body.playerEntries[0].position).toBe(1)
    expect(res.body.playerEntries[0].position).toBe(res.body.topEntries[1].position)
  })

  it('should rank tied entries by createdAt when outside the top entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const betterPlayer = await new PlayerFactory([apiKey.game]).one()
    const betterEntry = await new LeaderboardEntryFactory(leaderboard, [betterPlayer])
      .state(() => ({ score: 200 }))
      .one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const tiedEntries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    tiedEntries.forEach((entry, idx) => {
      entry.playerAlias = players[idx].aliases[0]
      entry.score = 100
      entry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, idx))
    })

    await em.persist([betterPlayer, betterEntry, ...players, ...tiedEntries]).flush()

    const player = players[2]
    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries[0].id).toBe(betterEntry.id)
    expect(res.body.playerEntries[0].id).toBe(tiedEntries[2].id)
    expect(res.body.playerEntries[0].position).toBe(3)
  })

  it('should rank tied entries with identical createdAt by id', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const players = await new PlayerFactory([apiKey.game]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)
    entries.forEach((entry, idx) => {
      entry.playerAlias = players[idx].aliases[0]
      entry.score = 100
      entry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, 0))
    })

    await em.persist([...players, ...entries]).flush()

    // players[1]'s entry was persisted second so it has the higher id and loses the tie
    const player = players[1]
    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries[0].id).toBe(entries[0].id)
    expect(res.body.playerEntries[0].id).toBe(entries[1].id)
    expect(res.body.playerEntries[0].position).toBe(1)
  })

  it("should rank the player's own tied entries by id", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .notUnique()
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player]).many(2)
    entries.forEach((entry) => {
      entry.playerAlias = player.aliases[0]
      entry.score = 100
      entry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, 0))
    })

    await em.persist([player, ...entries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 5 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    // the entry persisted first has the lower id and wins the tie
    expect(res.body.playerEntries.map((e: { position: number }) => e.position)).toEqual([0, 1])
  })

  it('should return no player entries if the player has no entry', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const players = await new PlayerFactory([apiKey.game]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)

    await em.persist([player, ...players, ...entries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerEntries).toHaveLength(0)
  })

  it('should not get top entries for an alias that does not belong to the game', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await em.persist([leaderboard, player]).flush()

    await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', '9999')
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not return hidden entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const playerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ playerAlias: player.aliases[0] }))
      .hidden()
      .one()

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(2)
    const hiddenEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers)
      .hidden()
      .many(2)

    await em.persist([player, playerEntry, ...otherPlayers, ...hiddenEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(0)
    expect(res.body.playerEntries).toHaveLength(0)
  })

  it('should not return dev build entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const devEntries = await new LeaderboardEntryFactory(leaderboard, [devPlayer]).many(2)

    const normalPlayer = await new PlayerFactory([apiKey.game]).one()
    const normalEntry = await new LeaderboardEntryFactory(leaderboard, [normalPlayer]).one()

    await em.persist([player, devPlayer, ...devEntries, normalPlayer, normalEntry]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 3 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(1)
    expect(res.body.topEntries[0].id).toBe(normalEntry.id)
    expect(res.body.playerEntries).toHaveLength(0)
  })

  it('should return dev build entries when dev data is included', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const devEntries = await new LeaderboardEntryFactory(leaderboard, [devPlayer]).many(2)

    await em.persist([player, devPlayer, ...devEntries]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 2 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-include-dev-data', '1')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries).toHaveLength(2)
    expect(
      res.body.topEntries.map((e: { id: number }) => e.id).sort((a: number, b: number) => a - b),
    ).toEqual(devEntries.map((e) => e.id).sort((a: number, b: number) => a - b))
  })

  it('should round sub-second createdAt values to seconds when ranking ties', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const players = await new PlayerFactory([apiKey.game]).many(2)
    const [roundedDownEntry, roundedUpEntry] = await new LeaderboardEntryFactory(
      leaderboard,
      players,
    ).many(2)
    roundedDownEntry.playerAlias = players[0].aliases[0]
    roundedDownEntry.score = 100
    roundedDownEntry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, 0, 200))
    roundedUpEntry.playerAlias = players[1].aliases[0]
    roundedUpEntry.score = 100
    roundedUpEntry.createdAt = new Date(Date.UTC(2022, 0, 1, 0, 0, 0, 700))

    await em.persist([...players, roundedDownEntry, roundedUpEntry]).flush()

    // MySQL rounds .200 down to :00 and .700 up to :01, so the .700 entry ranks after
    const player = players[1]
    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 1 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.topEntries[0].id).toBe(roundedDownEntry.id)
    expect(res.body.playerEntries[0].id).toBe(roundedUpEntry.id)
    expect(res.body.playerEntries[0].position).toBe(1)
  })

  it("should return all of a player's entries on a non-unique leaderboard", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .notUnique()
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, [player]).many(8)
    entries.forEach((entry, idx) => {
      entry.playerAlias = player.aliases[0]
      entry.score = idx + 1
    })

    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const otherEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer])
      .state(() => ({ playerAlias: otherPlayer.aliases[0], score: 1000 }))
      .one()

    await em.persist([player, ...entries, otherPlayer, otherEntry]).flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 5 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerEntries).toHaveLength(5)
    // best 5 of the 8 in rank order, positions 1-5 behind the opponent's score-1000 entry
    expect(res.body.playerEntries.map((e: { score: number }) => Number(e.score))).toEqual([
      8, 7, 6, 5, 4,
    ])
    expect(res.body.playerEntries.map((e: { position: number }) => e.position)).toEqual([
      1, 2, 3, 4, 5,
    ])
  })

  it('should rank player entries tied with other players on score and createdAt', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .notUnique()
      .state(() => ({ sortMode: LeaderboardSortMode.DESC }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).one()
    const playerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 100,
        createdAt: new Date(Date.UTC(2022, 0, 1, 0, 0, 0)),
      }))
      .one()

    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const otherEntry = await new LeaderboardEntryFactory(leaderboard, [otherPlayer])
      .state(() => ({
        playerAlias: otherPlayer.aliases[0],
        score: 100,
        createdAt: new Date(Date.UTC(2022, 0, 1, 0, 0, 0)),
      }))
      .one()

    const betterPlayer = await new PlayerFactory([apiKey.game]).one()
    const betterEntry = await new LeaderboardEntryFactory(leaderboard, [betterPlayer])
      .state(() => ({ playerAlias: betterPlayer.aliases[0], score: 200 }))
      .one()

    await em
      .persist([player, playerEntry, otherPlayer, otherEntry, betterPlayer, betterEntry])
      .flush()

    const res = await request(app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries/top`)
      .query({ limit: 5 })
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    // the player entry was persisted first so it has the lower id and wins the tie
    expect(res.body.playerEntries).toHaveLength(1)
    expect(res.body.playerEntries[0].position).toBe(1)
  })
})
