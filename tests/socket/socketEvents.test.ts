import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { ClickHouseClient } from '@clickhouse/client'
import { ClickhouseSocketEvent } from '../../src/socket/socketEvent'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import { APIKeyScope } from '../../src/entities/api-key'
import redisConfig from '../../src/config/redis.config'
import { createSocketTicket } from '../../src/services/api/socket-ticket-api.service'
import Redis from 'ioredis'
import createTestSocket from '../utils/createTestSocket'

describe('Socket events', () => {
  beforeAll(() => {
    vi.stubEnv('DISABLE_SOCKET_EVENTS', '0')
  })

  it('should track open, connected and close events', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    const redis = new Redis(redisConfig)
    const ticket = await createSocketTicket(redis, apiKey, false)
    await redis.quit()

    await createTestSocket(`/?ticket=${ticket}`, async () => {})

    let events: ClickhouseSocketEvent[] = []
    await vi.waitUntil(async () => {
      events = await (<ClickHouseClient>global.clickhouse).query({
        query: `SELECT * FROM socket_events WHERE game_id = ${apiKey.game.id} ORDER BY created_at`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickhouseSocketEvent>())
      return events.length === 3
    })

    expect(events[0].event_type).toBe('open')
    expect(events[0].req_or_res).toBe('req')
    expect(events[0].code).toBeNull()
    expect(events[0].game_id).toBe(apiKey.game.id)
    expect(events[0].player_alias_id).toBeNull()
    expect(events[0].dev_build).toBe(false)

    expect(events[1].event_type).toBe('v1.connected')
    expect(events[1].req_or_res).toBe('res')
    expect(events[1].code).toBeNull()
    expect(events[1].game_id).toBe(apiKey.game.id)
    expect(events[1].player_alias_id).toBeNull()
    expect(events[1].dev_build).toBe(false)

    expect(events[2].event_type).toBe('close')
    expect(events[2].req_or_res).toBe('req')
    expect(events[2].code).toBeNull()
    expect(events[2].game_id).toBe(apiKey.game.id)
    expect(events[2].player_alias_id).toBeNull()
    expect(events[2].dev_build).toBe(false)
  })

  it('should track requests and responses', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
    })

    let events: ClickhouseSocketEvent[] = []
    await vi.waitUntil(async () => {
      events = await (<ClickHouseClient>global.clickhouse).query({
        query: `SELECT * FROM socket_events WHERE game_id = ${player.game.id} ORDER BY created_at`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickhouseSocketEvent>())
      return events.length === 5
    })

    expect(events[0].event_type).toBe('open')
    expect(events[0].req_or_res).toBe('req')
    expect(events[0].code).toBeNull()
    expect(events[0].game_id).toBe(player.game.id)
    expect(events[0].player_alias_id).toBeNull()
    expect(events[0].dev_build).toBe(false)

    expect(events[1].event_type).toBe('v1.connected')
    expect(events[1].req_or_res).toBe('res')
    expect(events[1].code).toBeNull()
    expect(events[1].game_id).toBe(player.game.id)
    expect(events[1].player_alias_id).toBeNull()
    expect(events[1].dev_build).toBe(false)

    expect(events[2].event_type).toBe('v1.players.identify')
    expect(events[2].req_or_res).toBe('req')
    expect(events[2].code).toBeNull()
    expect(events[2].game_id).toBe(player.game.id)
    expect(events[2].player_alias_id).toBeNull()
    expect(events[2].dev_build).toBe(false)

    expect(events[3].event_type).toBe('v1.players.identify.success')
    expect(events[3].req_or_res).toBe('res')
    expect(events[3].code).toBeNull()
    expect(events[3].game_id).toBe(player.game.id)
    expect(events[3].player_alias_id).toBe(player.aliases[0].id)
    expect(events[3].dev_build).toBe(false)

    expect(events[4].event_type).toBe('close')
    expect(events[4].req_or_res).toBe('req')
    expect(events[4].code).toBeNull()
    expect(events[4].game_id).toBe(player.game.id)
    expect(events[4].player_alias_id).toBe(player.aliases[0].id)
    expect(events[4].dev_build).toBe(false)
  })

  it('should track errors', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        ...identifyMessage,
        data: {
          ...identifyMessage.data,
          socketToken: 'invalid'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid socket token',
          errorCode: 'INVALID_SOCKET_TOKEN'
        }
      })
    })

    let events: ClickhouseSocketEvent[] = []
    await vi.waitUntil(async () => {
      events = await (<ClickHouseClient>global.clickhouse).query({
        query: `SELECT * FROM socket_events WHERE game_id = ${player.game.id} ORDER BY created_at`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickhouseSocketEvent>())
      return events.length === 5
    })

    expect(events[0].event_type).toBe('open')
    expect(events[0].req_or_res).toBe('req')
    expect(events[0].code).toBeNull()
    expect(events[0].game_id).toBe(player.game.id)
    expect(events[0].player_alias_id).toBeNull()
    expect(events[0].dev_build).toBe(false)

    expect(events[1].event_type).toBe('v1.connected')
    expect(events[1].req_or_res).toBe('res')
    expect(events[1].code).toBeNull()
    expect(events[1].game_id).toBe(player.game.id)
    expect(events[1].player_alias_id).toBeNull()
    expect(events[1].dev_build).toBe(false)

    expect(events[2].event_type).toBe('v1.players.identify')
    expect(events[2].req_or_res).toBe('req')
    expect(events[2].code).toBeNull()
    expect(events[2].game_id).toBe(player.game.id)
    expect(events[2].player_alias_id).toBeNull()
    expect(events[2].dev_build).toBe(false)

    expect(events[3].event_type).toBe('v1.error')
    expect(events[3].req_or_res).toBe('res')
    expect(events[3].code).toBe('INVALID_SOCKET_TOKEN')
    expect(events[3].game_id).toBe(player.game.id)
    expect(events[3].player_alias_id).toBeNull()
    expect(events[3].dev_build).toBe(false)

    expect(events[4].event_type).toBe('close')
    expect(events[4].req_or_res).toBe('req')
    expect(events[4].code).toBeNull()
    expect(events[4].game_id).toBe(player.game.id)
    expect(events[4].player_alias_id).toBeNull()
    expect(events[4].dev_build).toBe(false)
  })

  it('should track dev build events', async () => {
    const [apiKey] = await createAPIKeyAndToken([])
    const redis = new Redis(redisConfig)
    const ticket = await createSocketTicket(redis, apiKey, true)
    await redis.quit()

    await createTestSocket(`/?ticket=${ticket}`, async () => {})

    let events: ClickhouseSocketEvent[] = []
    await vi.waitUntil(async () => {
      events = await (<ClickHouseClient>global.clickhouse).query({
        query: `SELECT * FROM socket_events WHERE game_id = ${apiKey.game.id} ORDER BY created_at`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickhouseSocketEvent>())
      return events.length === 3
    })

    expect(events[0].event_type).toBe('open')
    expect(events[0].req_or_res).toBe('req')
    expect(events[0].code).toBeNull()
    expect(events[0].game_id).toBe(apiKey.game.id)
    expect(events[0].player_alias_id).toBeNull()
    expect(events[0].dev_build).toBe(true)

    expect(events[1].event_type).toBe('v1.connected')
    expect(events[1].req_or_res).toBe('res')
    expect(events[1].code).toBeNull()
    expect(events[1].game_id).toBe(apiKey.game.id)
    expect(events[1].player_alias_id).toBeNull()
    expect(events[1].dev_build).toBe(true)

    expect(events[2].event_type).toBe('close')
    expect(events[2].req_or_res).toBe('req')
    expect(events[2].code).toBeNull()
    expect(events[2].game_id).toBe(apiKey.game.id)
    expect(events[2].player_alias_id).toBeNull()
    expect(events[2].dev_build).toBe(true)
  })
})