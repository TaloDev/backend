import { Factory } from 'hefty'
import casual from 'casual'
import PlayerAuth from '../../src/entities/player-auth'

export default class PlayerAuthFactory extends Factory<PlayerAuth> {
  constructor() {
    super(PlayerAuth, 'base')
    this.register('base', this.base)
  }

  protected base(): Partial<PlayerAuth> {
    return {
      email: casual.email,
      password: ''
    }
  }
}
