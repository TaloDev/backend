import { Factory } from 'hefty'
import casual from 'casual'
import Event from '../../src/entities/event.js'
import Player from '../../src/entities/player.js'
import { sub } from 'date-fns'
import randomDate from '../../src/lib/dates/randomDate.js'
import { generateEventData } from '../../src/lib/demo-data/generateDemoEvents.js'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]
  private eventTitles: string[]

  constructor(availablePlayers: Player[]) {
    super(Event, 'base')
    this.register('base', this.base)
    this.register('this week', this.thisWeek)
    this.register('this month', this.thisMonth)
    this.register('this year', this.thisYear)

    this.availablePlayers = availablePlayers
    this.eventTitles = ['Zone Explored', 'Item Looted', 'Treasure Discovered', 'Levelled up', 'Potion Used', 'Item Crafted', 'Secret Discovered', 'Item Bought', 'Talked to NPC']
  }

  protected async base(): Promise<Partial<Event>> {
    const player: Player = casual.random_element(this.availablePlayers)

    return {
      ...generateEventData(new Date()),
      game: player.game,
      playerAlias: casual.random_element(player.aliases.getItems())
    }
  }

  protected thisWeek(): Partial<Event> {
    return {
      createdAt: randomDate(sub(new Date(), { weeks: 1 }), new Date())
    }
  }

  protected thisMonth(): Partial<Event> {
    return {
      createdAt: randomDate(sub(new Date(), { months: 1 }), new Date())
    }
  }

  protected thisYear(): Partial<Event> {
    return {
      createdAt: randomDate(sub(new Date(), { years: 1 }), new Date())
    }
  }
}
