import { startOfDay } from 'date-fns'
import { millisecondsInDay } from 'date-fns/constants'

export type EventData = {
  name: string
  date: number
  count: number
  change: number
}

function calculateChange(count: number, lastEvent: EventData | undefined): number {
  const previousCount = lastEvent?.count ?? 0

  if (previousCount === 0) {
    return count
  }

  return (count - previousCount) / previousCount
}

export function fillDateGaps(
  data: Record<string, EventData[]>,
  startDateQuery: string,
  endDateQuery: string
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

    for (let currentDateMs = startDateMs; currentDateMs <= endDateMs; currentDateMs += millisecondsInDay) {
      const existingEvent = eventsByDate.get(currentDateMs)

      if (existingEvent) {
        filledData.push({ ...existingEvent, change: 0 })
      } else {
        filledData.push({
          name: seriesName,
          date: currentDateMs,
          count: 0,
          change: 0
        })
      }
    }

    for (let i = 0; i < filledData.length; i++) {
      const previousEvent = i > 0 ? filledData[i - 1] : undefined
      filledData[i].change = calculateChange(filledData[i].count, previousEvent)
    }

    result[seriesName] = filledData
  }

  return result
}
