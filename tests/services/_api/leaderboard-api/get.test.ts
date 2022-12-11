import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Leaderboard API service - get', () => {
  it('should get leaderboard entries if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)
    const hiddenEntries = await new LeaderboardEntryFactory(leaderboard, players).state('hidden').many(3)

    await (<EntityManager>global.em).persistAndFlush([...players, ...entries, ...hiddenEntries])

    const res = await request(global.app)
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
    const entries = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ playerAlias: player.aliases[0] })).many(2)

    const otherPlayers = await new PlayerFactory([apiKey.game]).many(3)
    const otherEntries = await new LeaderboardEntryFactory(leaderboard, otherPlayers).many(5)

    await (<EntityManager>global.em).persistAndFlush([player, ...entries, ...otherPlayers, ...otherEntries])

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    await request(global.app)
      .get(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get entries for a non-existent leaderboard', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_LEADERBOARDS])

    await request(global.app)
      .get('/v1/leaderboards/blah/entries')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })
})
