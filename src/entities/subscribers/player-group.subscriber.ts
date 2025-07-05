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

    for (const cs of args.uow.getChangeSets()) {
      const isRelevantChangeSet = changeSetFilters.some((filter) => filter(cs))

      if (isRelevantChangeSet) {
        if (cs.entity instanceof Player) {
          playersMap.set(cs.entity.id, cs.entity)
        } else if (cs.entity instanceof LeaderboardEntry) {
          const player = cs.entity.playerAlias.player
          playersMap.set(player.id, player)
        } else if (cs.entity instanceof PlayerGameStat) {
          const player = cs.entity.player
          playersMap.set(player.id, player)
        }
      }
    }

    for (const player of playersMap.values()) {
      await checkGroupMemberships(em, player)
    }
  }
}
