import { Factory } from 'hefty'
import casual from 'casual'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]
  private eventTitles: string[]

  constructor(availablePlayers: Player[]) {
    super(Event, 'base')
    this.register('base', this.base)

    this.availablePlayers = availablePlayers
    this.eventTitles = ['Zone Explored', 'Death', 'Item Looted', 'Treasure Discovered', 'Levelled up']
  }

  protected base(): Partial<Event> {
    return {
      name: casual.random_element(this.eventTitles),
      player: casual.random_element(this.availablePlayers)
    }
  }

}
