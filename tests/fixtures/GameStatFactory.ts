import { Factory } from 'hefty'
import casual from 'casual'
import GameStat from '../../src/entities/game-stat'
import Game from '../../src/entities/game'

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
    const minValue = casual.boolean ? casual.integer(-100, 0) : null
    const maxValue = casual.boolean ? casual.integer(minValue + 1, 100) : null
    const defaultValue = casual.integer(minValue ?? 0, maxValue ?? 100)

    return {
      game: casual.random_element(this.availableGames),
      internalName: casual.array_of_words(3).join('-'),
      name: casual.title,
      global,
      minValue,
      maxValue,
      defaultValue,
      globalValue: defaultValue,
      maxChange: casual.integer(0, 999),
      minTimeBetweenUpdates: casual.integer(0, 5)
    }
  }

  protected global(): Partial<GameStat> {
    return {
      global: true
    }
  }
}
