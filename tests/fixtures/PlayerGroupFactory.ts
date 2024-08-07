import { Factory } from 'hefty'
import casual from 'casual'
import PlayerGroup, { RuleMode } from '../../src/entities/player-group'

export default class PlayerGroupFactory extends Factory<PlayerGroup> {
  constructor() {
    super(PlayerGroup)
  }

  protected definition(): void {
    this.state(() => ({
      name: casual.title,
      description: casual.short_description,
      ruleMode: casual.random_element([RuleMode.AND, RuleMode.OR])
    }))
  }
}
