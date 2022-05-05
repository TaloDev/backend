import { Factory } from 'hefty'
import User, { UserType } from '../../src/entities/user'
import casual from 'casual'
import bcrypt from 'bcrypt'
import OrganisationFactory from './OrganisationFactory'
import UserTwoFactorAuth from '../../src/entities/user-two-factor-auth'
import UserRecoveryCode from '../../src/entities/user-recovery-code'
import generateRecoveryCodes from '../../src/lib/auth/generateRecoveryCodes'
import { Collection } from '@mikro-orm/core'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User, 'base')
    this.register('base', this.base)
    this.register('email confirmed', this.emailConfirmed)
    this.register('loginable', this.loginable)
    this.register('owner', this.owner)
    this.register('admin', this.admin)
    this.register('demo', this.demo)
    this.register('has2fa', this.has2fa)
  }

  protected async base(): Promise<Partial<User>> {
    const organisation = await new OrganisationFactory().one()

    return {
      email: casual.email,
      username: casual.username,
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
      email: casual.email,
      password: await bcrypt.hash('password', 10)
    }
  }

  protected owner(): Partial<User> {
    return {
      type: UserType.OWNER
    }
  }

  protected admin(): Partial<User> {
    return {
      type: UserType.ADMIN
    }
  }

  protected demo(): Partial<User> {
    return {
      type: UserType.DEMO,
      email: `demo+${Date.now()}@demo.io`,
      emailConfirmed: true
    }
  }

  protected has2fa(user: User): Partial<User> {
    const twoFactorAuth = new UserTwoFactorAuth(casual.word)
    twoFactorAuth.enabled = true

    const recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))

    return {
      twoFactorAuth,
      recoveryCodes
    }
  }
}
