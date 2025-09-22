import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'
import { getResultCacheOptions } from '../perf/getResultCacheOptions'
import { captureException } from '@sentry/node'
import { createRedisConnection } from '../../config/redis.config'

let redis: ReturnType<typeof createRedisConnection>

const enableLogging = process.env.NODE_ENV !== 'test'

function getGroupsFromPlayer(em: EntityManager, player: Player) {
  return em.repo(PlayerGroup).find({
    game: player.game
  }, {
    ...getResultCacheOptions(PlayerGroup.getCacheKey(player.game)),
    fields: ['id', 'name', 'rules', 'ruleMode', 'game.id']
  })
}

type LoadedGroups = Awaited<ReturnType<typeof getGroupsFromPlayer>>

async function runMembershipChecksForGroups(em: EntityManager, player: Player, groups: LoadedGroups): Promise<boolean> {
  const label = `Checking group memberships for ${player.id}`

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.time(label)
  }

  let shouldFlush = false

  for (const group of groups) {
    const eligible = await group.isPlayerEligible(em, player)
    const isInGroup = player.groups.getIdentifiers().includes(group.id)

    const eligibleButNotInGroup = eligible && !isInGroup
    const inGroupButNotEligible = !eligible && isInGroup

    if (eligibleButNotInGroup) {
      player.groups.add(em.getReference(PlayerGroup, group.id))
    } else if (inGroupButNotEligible) {
      player.groups.remove(em.getReference(PlayerGroup, group.id))
    }

    if (eligibleButNotInGroup || inGroupButNotEligible) {
      shouldFlush = true
    }
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.timeEnd(label)
  }

  return shouldFlush
}

export default async function checkGroupMemberships(em: EntityManager, player: Player) {
  if (!redis) {
    redis = createRedisConnection()
  }

  const groups = await getGroupsFromPlayer(em, player)

  if (groups.length === 0) {
    return
  }

  const redisKey = `checkMembership:${player.id}`
  let lockCreated: 'OK' | null = null

  try {
    lockCreated = await redis.set(redisKey, '1', 'EX', 30, 'NX')
    if (lockCreated) {
      const shouldFlush = await runMembershipChecksForGroups(em, player, groups)
      if (shouldFlush) {
        await em.flush()
      }
    }
  } catch (err) {
    if (err instanceof UniqueConstraintViolationException) {
      console.info(`Duplicate group attempt for player ${player.id}`)
      return
    }

    console.error(`Failed checking memberships: ${(err as Error).message}`)
    captureException(err)
  } finally {
    if (lockCreated) {
      await redis.del(redisKey)
    }
  }
}
