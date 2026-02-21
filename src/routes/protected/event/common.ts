import { startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'
import { calculateChange } from '../../../lib/math/calculateChange'

export type EventData = {
  name: string
  date: number
  count: number
  change: number
}

export function fillDateGaps(
  data: Record<string, EventData[]>,
  startDateQuery: string,
  endDateQuery: string,
): Record<string, EventData[]> {
  const startDateMs = startOfDay(new Date(startDateQuery)).getTime()
  const endDateMs = startOfDay(new Date(endDateQuery)).getTime()

  const result: Record<string, EventData[]> = {}

  for (const seriesName of Object.keys(data)) {
    const eventData = data[seriesName]
    const filledData: EventData[] = []

    const eventsByDate = new Map<number, EventData>()
    for (const event of eventData) {
      eventsByDate.set(event.date, event)
    }

    let prev: EventData | null = null
    for (
      let currentDateMs = startDateMs;
      currentDateMs <= endDateMs;
      currentDateMs += millisecondsInDay
    ) {
      const existingEvent = eventsByDate.get(currentDateMs)

      let entry: EventData

      if (existingEvent) {
        entry = {
          ...existingEvent,
          change: calculateChange(existingEvent.count, prev?.count ?? 0),
        }
      } else {
        entry = {
          name: seriesName,
          date: currentDateMs,
          count: 0,
          change: calculateChange(0, prev?.count ?? 0),
        }
      }

      filledData.push(entry)
      prev = entry
    }

    result[seriesName] = filledData
  }

  return result
}
