import { ChangeSetType, EventSubscriber, FlushEventArgs, Subscriber } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/mysql'
import checkGroupMemberships from '../../lib/groups/checkGroupMemberships'
import Player from '../player'
import PlayerProp from '../player-prop'

@Subscriber()
export default class PlayerPropSubscriber implements EventSubscriber {
  async beforeFlush(args: FlushEventArgs): Promise<void> {
    const changeSets = args.uow.getChangeSets()
    const cs = changeSets.find((cs) => cs.type === ChangeSetType.CREATE && cs.entity instanceof PlayerProp)
    const playerIsBeingCreated = changeSets.some((cs) => cs.type === ChangeSetType.CREATE && cs.entity instanceof Player)

    if (cs && !playerIsBeingCreated) {
      const player = (cs.entity as PlayerProp).player
      player.updatedAt = new Date()
      args.uow.computeChangeSet(player)
    }
  }

  async afterFlush(args: FlushEventArgs): Promise<void> {
    const em = (args.em as EntityManager).fork()

    const changeSets = args.uow.getChangeSets()
    const cs = changeSets.find((cs) => cs.type === ChangeSetType.CREATE && cs.entity instanceof PlayerProp)
    const playerIsBeingCreated = changeSets.some((cs) => cs.type === ChangeSetType.CREATE && cs.entity instanceof Player)

    if (cs && !playerIsBeingCreated) {
      const player = (cs.entity as PlayerProp).player
      await checkGroupMemberships(em, (player))
    }
  }
}
