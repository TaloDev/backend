import { ChangeSetType, EventSubscriber, FlushEventArgs, Subscriber } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/mysql'
import PlayerGroup from '../player-group'

@Subscriber()
export default class PlayerGroupSubscriber implements EventSubscriber {
  async afterFlush(args: FlushEventArgs): Promise<void> {
    const em = (args.em as EntityManager).fork()

    const changeSets = args.uow.getChangeSets()
    const cs = changeSets.find((cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof PlayerGroup)

    if (cs) {
      const group = cs.entity as PlayerGroup
      const players = await group.getQuery(em).getResultList()
      group.members.set(players)
      await em.flush()
    }
  }
}
