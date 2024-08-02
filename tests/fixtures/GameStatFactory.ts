import { Factory } from 'hefty'
import casual from 'casual'
import GameStat from '../../src/entities/game-stat'
import Game from '../../src/entities/game'

export default class GameStatFactory extends Factory<GameStat> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(GameStat)

    this.availableGames = availableGames
  }

  protected definition(): void {
    this.state(() => {
      const global = casual.boolean
      const minValue = casual.integer(-999, -1)
      const maxValue = casual.integer(1, 999)
      const defaultValue = casual.integer(minValue, maxValue)

      return {
        game: casual.random_element(this.availableGames),
        internalName: casual.array_of_words(3).join('-'),
        name: casual.title,
        global,
        minValue: casual.boolean ? minValue : null,
        maxValue: casual.boolean ? maxValue : null,
        defaultValue,
        globalValue: defaultValue,
        maxChange: casual.integer(0, 1000),
        minTimeBetweenUpdates: casual.integer(0, 5)
      }
    })
  }

  global(): this {
    return this.state(() => ({
      global: true
    }))
  }
}
