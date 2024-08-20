import { Factory } from 'hefty'
import casual from 'casual'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import { sub } from 'date-fns'
import randomDate from '../../src/lib/dates/randomDate'
import { generateEventData } from '../../src/lib/demo-data/generateDemoEvents'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]

  constructor(availablePlayers: Player[]) {
    super(Event)
    this.availablePlayers = availablePlayers
  }

  protected definition(): void {
    const player: Player = casual.random_element(this.availablePlayers)

    this.state(() => ({
      ...generateEventData(new Date()),
      game: player.game,
      playerAlias: casual.random_element(player.aliases.getItems())
    }))
  }

  thisWeek(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { weeks: 1 }), new Date())
    }))
  }

  thisMonth(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { months: 1 }), new Date())
    }))
  }

  thisYear(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { years: 1 }), new Date())
    }))
  }
}
