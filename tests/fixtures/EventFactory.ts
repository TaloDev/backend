import { rand, randNumber, randWord } from '@ngneat/falso'
import { endOfDay, startOfDay, sub } from 'date-fns'
import { Factory } from 'hefty'
import Event from '../../src/entities/event.js'
import Player from '../../src/entities/player.js'
import Prop from '../../src/entities/prop.js'
import randomDate from '../../src/lib/dates/randomDate.js'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]

  constructor(availablePlayers: Player[]) {
    super(Event)
    this.availablePlayers = availablePlayers
  }

  protected override definition() {
    const player: Player = rand(this.availablePlayers)

    this.state(() => ({
      name: randWord(),
      props: [new Prop('version', randNumber({ min: 1, max: 10 }).toString())],
      createdAt: randomDate(startOfDay(new Date()), endOfDay(new Date())),
      game: player.game,
      playerAlias: rand(player.aliases.getItems()),
    }))
  }

  thisWeek(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { weeks: 1 }), new Date()),
    }))
  }

  thisMonth(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { months: 1 }), new Date()),
    }))
  }

  thisYear(): this {
    return this.state(() => ({
      createdAt: randomDate(sub(new Date(), { years: 1 }), new Date()),
    }))
  }
}
