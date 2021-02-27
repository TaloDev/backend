import { Factory } from 'hefty'
import User from '../../src/entities/user'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User)
    this.register('email confirmed', this.emailConfirmed)
  }

  protected emailConfirmed(): Partial<User> {
    return {
      email: 'random@random.com',
      emailConfirmed: true
    }
  }
}
