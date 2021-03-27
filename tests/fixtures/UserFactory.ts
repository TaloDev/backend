import { Factory } from 'hefty'
import User, { UserType } from '../../src/entities/user'
import casual from 'casual'
import bcrypt from 'bcrypt'
import OrganisationFactory from './OrganisationFactory'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User, 'base')
    this.register('base', this.base)
    this.register('email confirmed', this.emailConfirmed)
    this.register('loginable', this.loginable)
    this.register('admin', this.admin)
  }

  protected async base(): Promise<Partial<User>> {
    const organisation = await new OrganisationFactory().one()

    return {
      email: casual.email,
      password: '',
      organisation
    }
  }

  protected emailConfirmed(): Partial<User> {
    return {
      emailConfirmed: true
    }
  }

  protected async loginable(): Promise<Partial<User>> {
    return {
      email: 'dev@trytalo.com',
      password: await bcrypt.hash('password', 10)
    }
  }

  protected admin(): Partial<User> {
    return {
      type: UserType.ADMIN 
    }
  }
}
