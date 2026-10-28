import { rand, randNumber, randSlug, randText } from '@ngneat/falso'
import { Factory } from 'hefty'
import GameStat from '../../src/entities/game-stat.js'
import Game from '../../src/entities/game.js'

export default class GameStatFactory extends Factory<GameStat> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(GameStat)

    this.availableGames = availableGames
  }

  protected override definition() {
    this.state(() => {
      return {
        game: rand(this.availableGames),
        internalName: randSlug(),
        name: randText(),
        global: false,
        minValue: null,
        maxValue: null,
        defaultValue: 0,
        globalValue: 0,
        maxChange: randNumber({ min: 1, max: 1000 }),
        minTimeBetweenUpdates: randNumber({ max: 5 }),
      }
    })
  }

  global(): this {
    return this.state(() => ({
      global: true,
    }))
  }
}
