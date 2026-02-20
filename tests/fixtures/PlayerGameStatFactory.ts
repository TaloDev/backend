import { randBoolean, randNumber } from '@ngneat/falso'
import { Factory } from 'hefty'
import PlayerGameStat from '../../src/entities/player-game-stat'

export default class PlayerGameStatFactory extends Factory<PlayerGameStat> {
  constructor() {
    super(PlayerGameStat)
  }

  protected override definition() {
    this.state(async ({ stat }) => {
      return {
        value: randBoolean()
          ? stat.defaultValue
          : randNumber({ min: stat.minValue ?? undefined, max: stat.maxValue ?? undefined }),
      }
    })
  }
}
