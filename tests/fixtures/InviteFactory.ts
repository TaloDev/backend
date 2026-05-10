import { rand, randEmail } from '@ngneat/falso'
import { Factory } from 'hefty'
import Invite from '../../src/entities/invite.js'
import { UserType } from '../../src/entities/user.js'
import UserFactory from './UserFactory.js'

export default class InviteFactory extends Factory<Invite> {
  constructor() {
    super(Invite)
  }

  protected override definition() {
    this.state(async (invite) => {
      const invitedByUser = await new UserFactory()
        .state(() => ({ organisation: invite.organisation }))
        .one()

      return {
        email: randEmail(),
        type: rand([UserType.DEV, UserType.ADMIN]),
        invitedByUser,
      }
    })
  }
}
