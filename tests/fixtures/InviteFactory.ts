import { Factory } from 'hefty'
import casual from 'casual'
import Invite from '../../src/entities/invite'
import { UserType } from '../../src/entities/user'
import UserFactory from './UserFactory'
import OrganisationFactory from './OrganisationFactory'

export default class InviteFactory extends Factory<Invite> {
  constructor() {
    super(Invite)
  }

  protected definition(): void {
    this.state(async () => {
      const organisation = await new OrganisationFactory().one()
      const invitedByUser = await new UserFactory().state(() => ({ organisation })).one()

      return {
        email: casual.email,
        organisation,
        type: casual.random_element([UserType.DEV, UserType.ADMIN]),
        invitedByUser
      }
    })
  }
}
