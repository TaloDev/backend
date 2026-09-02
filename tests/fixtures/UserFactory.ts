import { Collection } from '@mikro-orm/mysql'
import { randEmail, randUserName, randWord } from '@ngneat/falso'
import bcrypt from 'bcrypt'
import { Factory } from 'hefty'
import OrganisationMember from '../../src/entities/organisation-member.js'
import UserRecoveryCode from '../../src/entities/user-recovery-code.js'
import UserTwoFactorAuth from '../../src/entities/user-two-factor-auth.js'
import User, { UserType } from '../../src/entities/user.js'
import generateRecoveryCodes from '../../src/lib/auth/generateRecoveryCodes.js'
import OrganisationFactory from './OrganisationFactory.js'

export default class UserFactory extends Factory<User> {
  constructor() {
    super(User)
  }

  protected override definition() {
    this.state(async () => ({
      email: randEmail(),
      username: randUserName(),
      password: '',
      organisation: await new OrganisationFactory().one(),
      type: UserType.DEV,
    }))
  }

  override async one() {
    const user = await super.one()
    user.memberships.add(new OrganisationMember(user, user.organisation, user.type))
    return user
  }

  emailConfirmed(): this {
    return this.state(() => ({
      emailConfirmed: true,
    }))
  }

  loginable(): this {
    return this.state(async () => ({
      email: randEmail(),
      password: await bcrypt.hash('password', 10),
    }))
  }

  owner(): this {
    return this.state(() => ({
      type: UserType.OWNER,
    }))
  }

  admin(): this {
    return this.state(() => ({
      type: UserType.ADMIN,
    }))
  }

  has2fa() {
    return this.state(async (user) => {
      const twoFactorAuth = new UserTwoFactorAuth(randWord())
      twoFactorAuth.enabled = true

      const recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))

      return {
        twoFactorAuth,
        recoveryCodes,
      }
    })
  }
}
