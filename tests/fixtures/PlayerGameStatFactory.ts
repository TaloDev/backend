import { Factory } from 'hefty'
import PlayerGameStat from '../../src/entities/player-game-stat.js'

export default class PlayerGameStatFactory extends Factory<PlayerGameStat> {
  constructor() {
    super(PlayerGameStat)
  }

  protected override definition() {
    this.state(async ({ stat }) => ({
      value: stat.defaultValue,
    }))
  }
}
