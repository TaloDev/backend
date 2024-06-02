import { EntityManager, ChangeSetType, EventSubscriber, FlushEventArgs } from '@mikro-orm/mysql'
import checkGroupMemberships from '../../lib/groups/checkGroupMemberships.js'
import Player from '../player.js'

export default class PlayerSubscriber implements EventSubscriber {
  async afterFlush(args: FlushEventArgs): Promise<void> {
    const em = (args.em as EntityManager).fork()

    const changeSets = args.uow.getChangeSets()
    const cs = changeSets.find((cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof Player)

    if (cs) {
      await checkGroupMemberships(em, cs.entity as Player)
    }
  }
}
