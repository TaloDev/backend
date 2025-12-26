import { Factory } from 'hefty'
import PlayerAuth from '../../src/entities/player-auth'
import { randEmail } from '@ngneat/falso'

export default class PlayerAuthFactory extends Factory<PlayerAuth> {
  constructor() {
    super(PlayerAuth)
  }

  protected override definition() {
    this.state(() => ({
      email: randEmail(),
      password: ''
    }))
  }
}
