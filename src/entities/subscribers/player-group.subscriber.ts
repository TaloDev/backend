import { EntityManager, ChangeSetType, EventSubscriber, FlushEventArgs, ChangeSet } from '@mikro-orm/mysql'
import checkGroupMemberships from '../../lib/groups/checkGroupMemberships'
import Player from '../player'
import LeaderboardEntry from '../leaderboard-entry'
import PlayerGameStat from '../player-game-stat'

const changeSetFilters: ((cs: ChangeSet<Partial<unknown>>) => boolean)[] = [
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof Player,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof LeaderboardEntry,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof PlayerGameStat
]

export default class PlayerGroupSubscriber implements EventSubscriber {
  async afterFlush(args: FlushEventArgs): Promise<void> {
    const em = (args.em as EntityManager).fork()
    const playersMap: Map<string, Player> = new Map()

    const changeSets = args.uow.getChangeSets()
    for (const filter of changeSetFilters) {
      const match = changeSets.find(filter)

      if (match) {
        const entity = match.entity
        if (entity instanceof Player) {
          playersMap.set(entity.id, entity)
        } else if (entity instanceof LeaderboardEntry) {
          const player = entity.playerAlias.player
          playersMap.set(player.id, player)
        } else if (entity instanceof PlayerGameStat) {
          const player = entity.player
          playersMap.set(player.id, player)
        }
        break
      }
    }

    for (const player of playersMap.values()) {
      await checkGroupMemberships(em, player)
    }
  }
}
