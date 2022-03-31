import { Factory } from 'hefty'
import casual from 'casual'
import PlayerGameStat from '../../src/entities/player-game-stat'

export default class PlayerGameStatFactory extends Factory<PlayerGameStat> {
  constructor() {
    super(PlayerGameStat, 'base')
    this.register('base', this.base)
  }

  protected base(playerStat: PlayerGameStat): Partial<PlayerGameStat> {
    return {
      value: casual.boolean ? playerStat.stat.defaultValue : casual.integer(playerStat.stat.minValue, playerStat.stat.maxValue)
    }
  }
}
