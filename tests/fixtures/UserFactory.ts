import { Factory } from 'hefty'
import User, { UserType } from '../../src/entities/user'
import bcrypt from 'bcrypt'
import OrganisationFactory from './OrganisationFactory'
import UserTwoFactorAuth from '../../src/entities/user-two-factor-auth'
import UserRecoveryCode from '../../src/entities/user-recovery-code'
import generateRecoveryCodes from '../../src/lib/auth/generateRecoveryCodes'
import { Collection } from '@mikro-orm/mysql'
import { randEmail, randUserName, randWord } from '@ngneat/falso'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User)
  }

  protected definition(): void {
    this.state(async () => ({
      email: randEmail(),
      username: randUserName(),
      password: '',
      organisation: await new OrganisationFactory().one(),
      type: UserType.DEV
    }))
  }

  emailConfirmed(): this {
    return this.state(() => ({
      emailConfirmed: true
    }))
  }

  loginable(): this {
    return this.state(async () => ({
      email: randEmail(),
      password: await bcrypt.hash('password', 10)
    }))
  }

  owner(): this {
    return this.state(() => ({
      type: UserType.OWNER
    }))
  }

  admin(): this {
    return this.state(() => ({
      type: UserType.ADMIN
    }))
  }

  demo(): this {
    return this.state(() => ({
      type: UserType.DEMO,
      email: `demo+${Date.now()}@demo.io`,
      emailConfirmed: true
    }))
  }

  has2fa() {
    return this.state(async (user) => {
      const twoFactorAuth = new UserTwoFactorAuth(randWord())
      twoFactorAuth.enabled = true

      const recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))

      return {
        twoFactorAuth,
        recoveryCodes
      }
    })
  }
}
