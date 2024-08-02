import { Factory } from 'hefty'
import casual from 'casual'
import PlayerGameStat from '../../src/entities/player-game-stat'

export default class PlayerGameStatFactory extends Factory<PlayerGameStat> {
  constructor() {
    super(PlayerGameStat)
  }

  protected definition(): void {
    this.state(async ({ stat }) => {
      return {
        value: casual.boolean ? stat.defaultValue : casual.integer(stat.minValue, stat.maxValue)
      }
    })
  }
}
