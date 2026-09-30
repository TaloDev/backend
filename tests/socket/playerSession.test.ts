import { APIKeyScope } from '../../src/entities/api-key.js'
import { ClickHousePlayerSession } from '../../src/entities/player-session.js'
import { createSocketTicket } from '../../src/lib/sockets/createSocketTicket.js'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage.js'
import createTestSocket, { createTestClient } from '../utils/createTestSocket.js'

async function getPlayerSessions(playerId: string) {
  return clickhouse
    .query({
      query: `SELECT * FROM player_sessions WHERE player_id = '${playerId}'`,
      format: 'JSONEachRow',
    })
    .then((res) => res.json<ClickHousePlayerSession>())
}

describe('Socket player sessions', () => {
  it('should create a player session row with a null end date', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      const count = await clickhouse
        .query({
          query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      expect(count).toBe(1)
    })
  })

  it('should create a player session row with an end date and delete the previous row', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      const count = await clickhouse
        .query({
          query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      expect(count).toBe(1)
    })

    const count = await clickhouse
      .query({
        query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NOT NULL`,
        format: 'JSONEachRow',
      })
      .then((res) => res.json<{ count: string }>())
      .then((res) => Number(res[0].count))

    expect(count).toBe(1)
  })

  it('should set the end date and keep the start date when closing with the session', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    let startedAt!: string

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      const [openSession] = await getPlayerSessions(player.id)
      startedAt = openSession.started_at
    })

    const sessions = await getPlayerSessions(player.id)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].ended_at).not.toBeNull()
    expect(sessions[0].started_at).toBe(startedAt)
  })

  it('should not write a row or report an error when closing without a session', async () => {
    const { player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    // nothing was opened, so there is nothing to close and no error to report
    await expect(player.handleSession(false)).resolves.toBeUndefined()

    expect(await getPlayerSessions(player.id)).toHaveLength(0)
  })

  it('should close each socket own session when a player has two sockets', async () => {
    const { identifyMessage, ticket, player, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    // a second ticket and connection for the same player, reusing the same socket token
    const ticket2 = await createSocketTicket(redis, apiKey, false)
    const identifyMessage2 = { ...identifyMessage, data: { ...identifyMessage.data } }

    await createTestSocket(`/?ticket=${ticket}`, async (client1, _wss, port) => {
      const client2 = await createTestClient(port, `/?ticket=${ticket2}`, { waitForReady: false })

      await client1.identify(identifyMessage)
      await client2.identify(identifyMessage2)

      const openSessions = await getPlayerSessions(player.id)
      expect(openSessions).toHaveLength(2)
      expect(openSessions.every((session) => session.ended_at === null)).toBe(true)
    })

    const sessions = await getPlayerSessions(player.id)
    expect(sessions).toHaveLength(2)
    expect(sessions.every((session) => session.ended_at !== null)).toBe(true)
  })

  it('should not crash or write a second row when the same session is closed twice', async () => {
    const { player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])
    const session = await player.handleSession(true)

    await player.handleSession(false, session)
    await player.handleSession(false, session)

    const sessions = await getPlayerSessions(player.id)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].ended_at).not.toBeNull()
  })
})
