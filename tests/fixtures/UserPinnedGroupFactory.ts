import { Factory } from 'hefty'
import UserPinnedGroup from '../../src/entities/user-pinned-group'
import UserFactory from './UserFactory'
import PlayerGroupFactory from './PlayerGroupFactory'
import GameFactory from './GameFactory'
import OrganisationFactory from './OrganisationFactory'

export default class UserPinnedGroupFactory extends Factory<UserPinnedGroup> {
  constructor() {
    super(UserPinnedGroup)
  }

  protected definition(): void {
    this.state(async () => {
      const organisation = await new OrganisationFactory().one()
      const game = await new GameFactory(organisation).one()

      return {
        user: await new UserFactory().state(() => ({ organisation })).one(),
        group: await new PlayerGroupFactory().state(() => ({ game })).one()
      }
    })
  }
}
