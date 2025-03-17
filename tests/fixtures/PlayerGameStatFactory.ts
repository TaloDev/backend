import { Factory } from 'hefty'
import PlayerGameStat from '../../src/entities/player-game-stat'
import { randBoolean, randNumber } from '@ngneat/falso'

export default class PlayerGameStatFactory extends Factory<PlayerGameStat> {
  constructor() {
    super(PlayerGameStat)
  }

  protected definition(): void {
    this.state(async ({ stat }) => {
      return {
        value: randBoolean()
          ? stat.defaultValue
          : randNumber({ min: stat.minValue ?? undefined, max: stat.maxValue ?? undefined })
      }
    })
  }
}
