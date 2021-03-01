import { Factory } from 'hefty'
import User from '../../src/entities/user'
import casual from 'casual'
import bcrypt from 'bcrypt'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User, 'base')
    this.register('base', this.base)
    this.register('email confirmed', this.emailConfirmed)
    this.register('loginable', this.loginable)
  }

  protected base(): Partial<User> {
    return {
      email: casual.email
    }
  }

  protected emailConfirmed(): Partial<User> {
    return {
      emailConfirmed: true
    }
  }

  protected async loginable(): Promise<Partial<User>> {
    return {
      email: 'admin@trytalo.com',
      password: await bcrypt.hash('password', 10)
    }
  }
}
