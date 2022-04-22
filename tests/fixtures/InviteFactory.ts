import { Factory } from 'hefty'
import casual from 'casual'
import Invite from '../../src/entities/invite'
import { UserType } from '../../src/entities/user'
import UserFactory from './UserFactory'

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
