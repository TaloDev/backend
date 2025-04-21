import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import createTestSocket from '../utils/createTestSocket'

describe('Socket player sessions', () => {
  it('should create a player session row with a null end date', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      const count = await clickhouse.query({
        query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      expect(count).toBe(1)
    })
  })

  it('should create a player session row with an end date and delete the previous row', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      const count = await clickhouse.query({
        query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      expect(count).toBe(1)
    })

    const count = await clickhouse.query({
      query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NOT NULL`,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())
      .then((res) => Number(res[0].count))

    expect(count).toBe(1)
  })
})
