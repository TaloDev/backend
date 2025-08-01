import { EntityManager, ChangeSetType, EventSubscriber, FlushEventArgs, ChangeSet } from '@mikro-orm/mysql'
import checkGroupMemberships from '../../lib/groups/checkGroupMemberships'
import Player from '../player'
import LeaderboardEntry from '../leaderboard-entry'
import PlayerGameStat from '../player-game-stat'
import { createRedisConnection } from '../../config/redis.config'

const enableLogging = process.env.NODE_ENV !== 'test'

const changeSetFilters: ((cs: ChangeSet<Partial<unknown>>) => boolean)[] = [
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof Player,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof LeaderboardEntry,
  (cs) => [ChangeSetType.CREATE, ChangeSetType.UPDATE].includes(cs.type) && cs.entity instanceof PlayerGameStat
]

let redis: ReturnType<typeof createRedisConnection>

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

    if (playersMap.size === 0) {
      return
    }

    if (!redis) {
      redis = createRedisConnection()
    }

    for (const player of playersMap.values()) {
      const redisKey = `checkMembership:${player.id}`
      let lockCreated = false

      try {
        const setSuccess = await redis.set(redisKey, '1', 'EX', 30, 'NX')
        if (setSuccess === 'OK') {
          lockCreated = true
          /* v8 ignore next 3 */
          if (enableLogging) {
            console.info(`Group memberships lock created for ${player.id}`)
          }

          if (await checkGroupMemberships(em, player)) {
            const label = `Refreshing memberships for ${player.id}`

            /* v8 ignore next 3 */
            if (enableLogging) {
              console.time(label)
            }

            await player.groups.loadItems({ refresh: true })

            /* v8 ignore next 3 */
            if (enableLogging) {
              console.timeEnd(label)
            }
          }
        }
      } finally {
        if (lockCreated) {
          /* v8 ignore next 3 */
          if (enableLogging) {
            console.info(`Group memberships lock released for ${player.id}`)
          }

          await redis.del(redisKey)
        }
      }
    }
  }
}
