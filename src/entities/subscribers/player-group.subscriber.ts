import { EntityManager, ChangeSetType, EventSubscriber, FlushEventArgs, ChangeSet } from '@mikro-orm/mysql'
import checkGroupMemberships from '../../lib/groups/checkGroupMemberships'
import Player from '../player'
import LeaderboardEntry from '../leaderboard-entry'
import PlayerGameStat from '../player-game-stat'
import { createRedisConnection } from '../../config/redis.config'
import { captureException } from '@sentry/node'

const changeSetFilters: ((cs: ChangeSet<Partial<unknown>>) => boolean)[] = [
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof Player,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof LeaderboardEntry,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof PlayerGameStat
]

let redis: ReturnType<typeof createRedisConnection>

export async function checkGroupsForPlayers(em: EntityManager, players: Player[]) {
  if (!redis) {
    redis = createRedisConnection()
  }

  for (const player of players) {
    const redisKey = `checkMembership:${player.id}`
    let lockCreated: 'OK' | null = null

    try {
      lockCreated = await redis.set(redisKey, '1', 'EX', 30, 'NX')
      if (lockCreated) {
        const shouldRefresh = await checkGroupMemberships(em, player)
        if (shouldRefresh) {
          await player.groups.loadItems({ refresh: true })
        }
      }
    } catch (err) {
      console.error(`Failed checking memberships: ${(err as Error).message}`)
      captureException(err)
    } finally {
      if (lockCreated) {
        await redis.del(redisKey)
      }
    }
  }
}

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
          // no op - we defer this to the FlushStatSnapshotsQueueHandler
        }
      }
    }

    if (playersMap.size > 0) {
      await checkGroupsForPlayers(em, Array.from(playersMap.values()))
    }
    em.clear()
  }
}
