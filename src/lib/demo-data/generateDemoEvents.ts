import { EntityManager } from '@mikro-orm/mysql'
import { Request } from 'koa-clay'
import Event from '../../entities/event'
import { addDays, differenceInDays, endOfDay, startOfDay, subMonths } from 'date-fns'
import casual from 'casual'
import Prop from '../../entities/prop'
import Game from '../../entities/game'
import randomDate from '../dates/randomDate'
import PlayerAlias from '../../entities/player-alias'

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
      zoneId: () => casual.integer(1, 30).toString(),
      treasureId: () => casual.integer(1, 255).toString()
    }
  },
  {
    name: 'Levelled up',
    props: {
      newLevel: () => casual.integer(2, 60).toString(),
      timeTaken: () => casual.integer(10, 1000).toString()
    }
  },
  {
    name: 'Potion Used',
    props: {
      itemId: () => casual.integer(1, 255).toString(),
      type: () => casual.random_element(['HP', 'MP'])
    }
  },
  {
    name: 'Item Crafted',
    props: {
      itemId: () => casual.integer(1, 255).toString(),
      quantity: () => casual.integer(1, 5).toString()
    }
  },
  {
    name: 'Quest Completed',
    props: {
      questId: () => casual.integer(1, 255).toString()
    }
  }
]

function getDemoEventProps(demoEvent: DemoEvent) {
  const eventProps: Prop[] = []

  for (const key in demoEvent.props) {
    eventProps.push(new Prop(key, demoEvent.props[key]()))
  }

  eventProps.push(new Prop('TALO_DEMO_EVENT', '1'))

  return eventProps
}

export function generateEventData(date: Date): Partial<Event> {
  const randomEvent: DemoEvent = casual.random_element(demoEvents)
  const eventProps: Prop[] = getDemoEventProps(randomEvent)
  const createdAt = randomDate(startOfDay(date), endOfDay(date))

  return {
    name: randomEvent.name,
    props: eventProps,
    createdAt
  }
}

export async function generateDemoEvents(req: Request): Promise<void> {
  const em: EntityManager = req.ctx.em


  const games = await em.getRepository(Game).find({
    organisation: {
      name: process.env.DEMO_ORGANISATION_NAME
    }
  })

  const startDate = subMonths(new Date(), 1)

  for (const game of games) {
    const events = await em.getRepository(Event).find({
      playerAlias: {
        player: {
          game
        }
      },
      createdAt: {
        $gte: startDate
      }
    })

    if (events.length === 0) {
      const prev: { [key: string]: number } = {}

      const playerAliases = await em.getRepository(PlayerAlias).find({
        player: {
          game
        }
      })

      for (let dayStep = 0; dayStep < differenceInDays(new Date(), startDate) + 1; dayStep++) {
        const day = addDays(startDate, dayStep)

        for (const demoEvent of demoEvents) {
          let numToGenerate = casual.integer(1, 3)

          if (prev[demoEvent.name]) {
            const increaseAmount = Math.max(casual.integer(0, 3) === 0 ? 0 : 1, Math.ceil(prev[demoEvent.name] * (casual.integer(0, 30) / 100)))
            numToGenerate = prev[demoEvent.name] + (increaseAmount * (casual.integer(0, 2) === 0 ? -1 : 1))
          }

          prev[demoEvent.name] = numToGenerate

          for (let i = 0; i < numToGenerate; i++) {
            const event = new Event(demoEvent.name, game)
            event.setProps(getDemoEventProps(demoEvent))
            event.playerAlias = casual.random_element(playerAliases)
            event.createdAt = randomDate(startOfDay(day), endOfDay(day))
            await em.persist(event)
          }
        }
      }
    }
  }

  await em.flush()
}
