import { Factory } from 'hefty'
import GameStat from '../../src/entities/game-stat'
import Game from '../../src/entities/game'
import { rand, randBoolean, randNumber, randSlug, randText } from '@ngneat/falso'

export default class GameStatFactory extends Factory<GameStat> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(GameStat)

    this.availableGames = availableGames
  }

  protected definition(): void {
    this.state(() => {
      const global = randBoolean()
      const minValue = randNumber({ min: -999, max: -1 })
      const maxValue = randNumber({ min: 1, max: 999 })
      const defaultValue = randNumber({ min: minValue, max: maxValue })

      return {
        game: rand(this.availableGames),
        internalName: randSlug(),
        name: randText(),
        global,
        minValue: randBoolean() ? minValue : null,
        maxValue: randBoolean() ? maxValue : null,
        defaultValue,
        globalValue: defaultValue,
        maxChange: randNumber({ max: 1000 }),
        minTimeBetweenUpdates: randNumber({ max: 5 })
      }
    })
  }

  global(): this {
    return this.state(() => ({
      global: true
    }))
  }
}
