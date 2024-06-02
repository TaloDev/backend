import { Factory } from 'hefty'
import casual from 'casual'
import Invite from '../../src/entities/invite.js'
import { UserType } from '../../src/entities/user.js'
import UserFactory from './UserFactory.js'

export default class InviteFactory extends Factory<Invite> {
  constructor() {
    super(Invite, 'base')
    this.register('base', this.base)
  }

  protected async base(invite: Partial<Invite>): Promise<Partial<Invite>> {
    const invitedByUser = await new UserFactory().with(() => ({ organisation: invite.organisation })).one()

    return {
      email: casual.email,
      type: casual.random_element([UserType.DEV, UserType.ADMIN]),
      invitedByUser
    }
  }
}
