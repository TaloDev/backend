import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAuth from '../../src/entities/player-auth'

export default class PlayerAuthFactory extends Factory<PlayerAuth> {
  constructor() {
    super(PlayerAuth)
  }

  protected definition(): void {
    this.state(() => ({
      email: casual.email,
      password: ''
    }))
  }
}
