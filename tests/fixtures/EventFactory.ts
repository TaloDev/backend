import { Factory } from 'hefty'
import casual from 'casual'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import { randomDate } from '../utils/randomDate'
import { sub } from 'date-fns'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]
  private eventTitles: string[]

  constructor(availablePlayers: Player[]) {
    super(Event, 'base')
    this.register('base', this.base)
    this.register('thisWeek', this.thisWeek)
    this.register('thisMonth', this.thisMonth)
    this.register('thisYear', this.thisYear)

    this.availablePlayers = availablePlayers
    this.eventTitles = ['Zone Explored', 'Death', 'Item Looted', 'Treasure Discovered', 'Levelled up']
  }

  protected base(): Partial<Event> {
    return {
      name: casual.random_element(this.eventTitles),
      player: casual.random_element(this.availablePlayers)
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
