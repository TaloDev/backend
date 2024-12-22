import { Queue } from 'bullmq'
import createQueue from '../lib/queues/createQueue'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { SocketMessageRequest, SocketMessageResponse } from './messages/socketMessage'
import { ClickHouseClient } from '@clickhouse/client'

export type ClickhouseSocketEvent = {
  event_type: string
  req_or_res: 'req' | 'res'
  code: string | null
  game_id: number
  player_alias_id: number | null
  dev_build: boolean
  created_at: string
}

export type SocketEvent = {
  id: string
  eventType: SocketMessageRequest | SocketMessageResponse | 'open' | 'close' | 'unknown'
  reqOrRes: 'req' | 'res'
  code: string | null
  gameId: number
  playerAliasId: number | null
  devBuild: boolean
  createdAt: Date
}

export type SocketEventData = Omit<SocketEvent, 'id' | 'createdAt'>

function getInsertableData(event: SocketEventData): ClickhouseSocketEvent {
  return {
    event_type: event.eventType,
    req_or_res: event.reqOrRes,
    code: event.code,
    game_id: event.gameId,
    player_alias_id: event.playerAliasId,
    dev_build: event.devBuild,
    created_at: formatDateForClickHouse(new Date(), true)
  }
}

export function createSocketEventQueue(clickhouse: ClickHouseClient): Queue<SocketEventData> {
  return createQueue<SocketEventData>('socketEvents', async (job) => {
    await clickhouse.insert({
      table: 'socket_events',
      values: [getInsertableData(job.data)],
      format: 'JSONEachRow'
    })
  })
}
