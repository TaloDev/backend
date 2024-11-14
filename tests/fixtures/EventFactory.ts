import { Factory } from 'hefty'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import { sub } from 'date-fns'
import randomDate from '../../src/lib/dates/randomDate'
import { generateEventData } from '../../src/lib/demo-data/generateDemoEvents'
import { rand } from '@ngneat/falso'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]

  constructor(availablePlayers: Player[]) {
    super(Event)
    this.availablePlayers = availablePlayers
  }

  protected definition(): void {
    const player: Player = rand(this.availablePlayers)

    this.state(() => ({
      ...generateEventData(new Date()),
      game: player.game,
      playerAlias: rand(player.aliases.getItems())
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
