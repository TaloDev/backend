import { Factory } from 'hefty'
import PlayerGroup, { RuleMode } from '../../src/entities/player-group'
import { rand, randText } from '@ngneat/falso'

export default class PlayerGroupFactory extends Factory<PlayerGroup> {
  constructor() {
    super(PlayerGroup)
  }

  protected definition(): void {
    this.state(() => ({
      name: randText(),
      description: randText(),
      ruleMode: rand([RuleMode.AND, RuleMode.OR])
    }))
  }
}
