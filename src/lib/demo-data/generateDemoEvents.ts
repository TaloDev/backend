import { EntityManager } from '@mikro-orm/mysql'
import { Request } from 'koa-clay'
import Event from '../../entities/event'
import { addDays, differenceInDays, endOfDay, startOfDay, subMonths } from 'date-fns'
import Prop from '../../entities/prop'
import Game from '../../entities/game'
import randomDate from '../dates/randomDate'
import PlayerAlias from '../../entities/player-alias'
import { formatDateForClickHouse } from '../clickhouse/formatDateTime'
import { rand, randNumber } from '@ngneat/falso'
import { ClickHouseClient } from '@clickhouse/client'
import assert from 'node:assert'

type DemoEvent = {
  name: string
  props?: {
    [key: string]: () => string
  }
}

const demoEvents: DemoEvent[] = [
  {
    name: 'Treasure Discovered',
    props: {
      zoneId: () => randNumber({ min: 1, max: 30 }).toString(),
      treasureId: () => randNumber({ min: 1, max: 255 }).toString()
    }
  },
  {
    name: 'Levelled up',
    props: {
      newLevel: () => randNumber({ min: 2, max: 60 }).toString(),
      timeTaken: () => randNumber({ min: 10, max: 1000 }).toString()
    }
  },
  {
    name: 'Potion Used',
    props: {
      itemId: () => randNumber({ min: 1, max: 255 }).toString(),
      type: () => rand(['HP', 'MP'])
    }
  },
  {
    name: 'Item Crafted',
    props: {
      itemId: () => randNumber({ min: 1, max: 255 }).toString(),
      quantity: () => randNumber({ min: 1, max: 5 }).toString()
    }
  },
  {
    name: 'Quest Completed',
    props: {
      questId: () => randNumber({ min: 1, max: 255 }).toString()
    }
  }
]

function getDemoEventProps(demoEvent: DemoEvent) {
  const eventProps: Prop[] = []

  for (const key in demoEvent.props) {
    assert(demoEvent.props[key])
    eventProps.push(new Prop(key, demoEvent.props[key]()))
  }

  eventProps.push(new Prop('TALO_DEMO_EVENT', '1'))

  return eventProps
}

export function generateEventData(date: Date): Partial<Event> {
  const randomEvent: DemoEvent = rand(demoEvents)
  const eventProps: Prop[] = getDemoEventProps(randomEvent)
  const createdAt = randomDate(startOfDay(date), endOfDay(date))

  return {
    name: randomEvent.name,
    props: eventProps,
    createdAt
  }
}

async function getEventCount(clickhouse: ClickHouseClient, game: Game, startDate: Date): Promise<number> {
  const startDateFormatted = formatDateForClickHouse(startDate)

  const query = `
    SELECT count() AS count
    FROM events
    WHERE game_id = ${game.id}
      AND created_at >= '${startDateFormatted}'
  `

  try {
    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())

    assert(result[0])
    return Number(result[0].count)
  /* v8 ignore next 4 */
  } catch (err) {
    console.error('Error fetching event count from ClickHouse:', err)
    return 0
  }
}

export async function generateDemoEvents(req: Request): Promise<void> {
  const em: EntityManager = req.ctx.em
  const clickhouse: ClickHouseClient = req.ctx.clickhouse

  const games = await em.getRepository(Game).find({
    organisation: {
      name: process.env.DEMO_ORGANISATION_NAME
    }
  })

  const startDate = subMonths(new Date(), 1)

  for (const game of games) {
    const eventCount = await getEventCount(clickhouse, game, startDate)

    if (eventCount === 0) {
      const eventsToInsert: Event[] = []

      const prev: { [key: string]: number } = {}

      const playerAliases = await em.getRepository(PlayerAlias).find({
        player: {
          game
        }
      })

      if (playerAliases.length === 0) {
        continue
      }

      for (let dayStep = 0; dayStep < differenceInDays(new Date(), startDate) + 1; dayStep++) {
        const day = addDays(startDate, dayStep)

        for (const demoEvent of demoEvents) {
          let numToGenerate = randNumber({ min: 1, max: 3 })

          const previousDemoEvent = prev[demoEvent.name]
          if (previousDemoEvent) {
            const increaseAmount = Math.max(randNumber({ max: 3 }) === 0 ? 0 : 1, Math.ceil(previousDemoEvent * (randNumber({ max: 30 }) / 100)))
            numToGenerate = previousDemoEvent + (increaseAmount * (randNumber({ max: 2 }) === 0 ? -1 : 1))
          }

          prev[demoEvent.name] = numToGenerate

          for (let i = 0; i < numToGenerate; i++) {
            eventsToInsert.push(new Event().construct(demoEvent.name, game))
            eventsToInsert.at(-1)!.setProps(getDemoEventProps(demoEvent))
            eventsToInsert.at(-1)!.playerAlias = rand(playerAliases)
            eventsToInsert.at(-1)!.createdAt = randomDate(startOfDay(day), endOfDay(day))
          }
        }
      }

      await clickhouse.insert({
        table: 'events',
        values: eventsToInsert.map((event) => event.toInsertable()),
        format: 'JSONEachRow'
      })
      await clickhouse.insert({
        table: 'event_props',
        values: eventsToInsert.flatMap((event) => event.getInsertableProps()),
        format: 'JSONEachRow'
      })
    }
  }
}
