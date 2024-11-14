import { Factory } from 'hefty'
import Invite from '../../src/entities/invite'
import { UserType } from '../../src/entities/user'
import UserFactory from './UserFactory'
import { rand, randEmail } from '@ngneat/falso'

export default class InviteFactory extends Factory<Invite> {
  constructor() {
    super(Invite)
  }

  protected definition(): void {
    this.state(async (invite) => {
      const invitedByUser = await new UserFactory().state(() => ({ organisation: invite.organisation })).one()

      return {
        email: randEmail(),
        type: rand([UserType.DEV, UserType.ADMIN]),
        invitedByUser
      }
    })
  }
}
