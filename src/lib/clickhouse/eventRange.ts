import { formatDateForClickHouse } from './formatDateTime.js'

type EventRange = {
  gameId: number
  from: Date
  to: Date
}

export function eventRangeWhere(includeDevData: boolean) {
  return `
    game_id = {gameId:UInt32}
      AND created_at >= {from:DateTime64(3)}
      AND created_at <= {to:DateTime64(3)}
      ${includeDevData ? '' : 'AND dev_build = false'}
  `
}

export function eventRangeParams({ gameId, from, to }: EventRange) {
  return {
    gameId,
    from: formatDateForClickHouse(from),
    to: formatDateForClickHouse(to),
  }
}
