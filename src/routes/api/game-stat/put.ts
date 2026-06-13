import { differenceInSeconds } from 'date-fns'
import { APIKeyScope } from '../../../entities/api-key.js'
import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot.js'
import PlayerGameStat from '../../../entities/player-game-stat.js'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations.js'
import { withRedisLock } from '../../../lib/perf/redisLock.js'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue.js'
import { FlushStatSnapshotsQueueHandler } from '../../../lib/queues/game-metrics/flush-stat-snapshots-queue-handler.js'
import { apiRoute, withMiddleware } from '../../../lib/routing/router.js'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema.js'
import { loadAlias } from '../../../middleware/player-alias-middleware.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'
import { loadStatWithAlias } from './common.js'
import { putDocs } from './docs.js'

let queueHandler: FlushStatSnapshotsQueueHandler

function getQueueHandler() {
  if (!queueHandler) {
    queueHandler = new FlushStatSnapshotsQueueHandler()
  }
  return queueHandler
}

export const putRoute = apiRoute({
  method: 'put',
  path: '/:internalName',
  docs: putDocs,
  schema: (z) => ({
    headers: z.looseObject({
      'x-talo-alias': playerAliasHeaderSchema,
    }),
    route: z.object({
      internalName: z.string().meta({ description: 'The internal name of the stat' }),
    }),
    body: z.object({
      change: z.number().meta({
        description: 'The amount to add to the current value of the stat (can be negative)',
      }),
    }),
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.WRITE_GAME_STATS]),
    loadAlias,
    loadStatWithAlias,
  ),
  handler: async (ctx) => {
    const { change } = ctx.state.validated.body
    const em = ctx.em

    const stat = ctx.state.stat
    const alias = ctx.state.alias
    const continuityDate = ctx.state.continuityDate
    const lockKey = `locks:player-stat:${alias.player.id}:${stat.id}`

    const result = await withRedisLock({ key: lockKey }, async () => {
      const existingPlayerStat = await em.repo(PlayerGameStat).findOne({
        player: alias.player,
        stat,
      })

      if (
        existingPlayerStat &&
        differenceInSeconds(new Date(), existingPlayerStat.updatedAt) < stat.minTimeBetweenUpdates
      ) {
        return {
          error: `Stat cannot be updated more often than every ${stat.minTimeBetweenUpdates} seconds`,
        }
      }

      if (Math.abs(change) > (stat.maxChange ?? Infinity)) {
        return {
          error: `Stat change cannot be more than ${stat.maxChange}`,
        }
      }

      const currentValue = existingPlayerStat?.value ?? stat.defaultValue

      if (currentValue + change < (stat.minValue ?? -Infinity)) {
        return {
          error: `Stat would go below the minValue of ${stat.minValue}`,
        }
      }

      if (currentValue + change > (stat.maxValue ?? Infinity)) {
        return {
          error: `Stat would go above the maxValue of ${stat.maxValue}`,
        }
      }

      const newValue = currentValue + change
      const now = new Date()
      const createdAt = continuityDate ?? now

      await PlayerGameStat.upsert({
        em,
        player: alias.player,
        stat,
        value: newValue,
        change,
        createdAt,
        updatedAt: now,
      })

      const refreshed = await em
        .repo(PlayerGameStat)
        .findOneOrFail({ player: alias.player, stat }, { refresh: true })

      return refreshed
    })

    if ('error' in result) {
      return {
        status: 400,
        body: {
          message: result.error,
        },
      }
    }

    const refreshedPlayerStat = result

    await Promise.all([
      deferClearResponseCache(PlayerGameStat.getCacheKey(alias.player, stat)),
      deferClearResponseCache(PlayerGameStat.getListCacheKey(alias.player)),
      stat.global ? stat.incrementGlobalValue(ctx.redis, change) : Promise.resolve(),
    ])

    await triggerIntegrations(em, ctx.state.game, (integration) => {
      return integration.handleStatUpdated(em, refreshedPlayerStat)
    })

    const snapshot = new PlayerGameStatSnapshot()
    snapshot.construct(alias, refreshedPlayerStat)
    snapshot.change = change
    if (continuityDate) {
      snapshot.createdAt = continuityDate
    }
    await getQueueHandler().add(snapshot)

    return {
      status: 200,
      body: {
        playerStat: refreshedPlayerStat,
      },
    }
  },
})
