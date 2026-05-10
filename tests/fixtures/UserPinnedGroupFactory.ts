import { Factory } from 'hefty'
import UserPinnedGroup from '../../src/entities/user-pinned-group.js'
import GameFactory from './GameFactory.js'
import OrganisationFactory from './OrganisationFactory.js'
import PlayerGroupFactory from './PlayerGroupFactory.js'
import UserFactory from './UserFactory.js'

export default class UserPinnedGroupFactory extends Factory<UserPinnedGroup> {
  constructor() {
    super(UserPinnedGroup)
  }

  protected override definition() {
    this.state(async () => {
      const organisation = await new OrganisationFactory().one()
      const game = await new GameFactory(organisation).one()

      return {
        user: await new UserFactory().state(() => ({ organisation })).one(),
        group: await new PlayerGroupFactory().state(() => ({ game })).one(),
      }
    })
  }
}
