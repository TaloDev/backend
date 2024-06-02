import { Factory } from 'hefty'
import casual from 'casual'
import GameStat from '../../src/entities/game-stat.js'
import Game from '../../src/entities/game.js'

export default class GameStatFactory extends Factory<GameStat> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(GameStat, 'base')
    this.register('base', this.base)
    this.register('global', this.global)

    this.availableGames = availableGames
  }

  protected base(): Partial<GameStat> {
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
  }

  protected global(): Partial<GameStat> {
    return {
      global: true
    }
  }
}
