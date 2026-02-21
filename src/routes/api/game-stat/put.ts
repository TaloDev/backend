import { raw } from '@mikro-orm/mysql'
import { differenceInSeconds } from 'date-fns'
import assert from 'node:assert'
import { APIKeyScope } from '../../../entities/api-key'
import PlayerGameStat from '../../../entities/player-game-stat'
import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { deferClearResponseCache } from '../../../lib/perf/responseCacheQueue'
import { FlushStatSnapshotsQueueHandler } from '../../../lib/queues/game-metrics/flush-stat-snapshots-queue-handler'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { playerAliasHeaderSchema } from '../../../lib/validation/playerAliasHeaderSchema'
import { loadAlias } from '../../../middleware/player-alias-middleware'
import { requireScopes } from '../../../middleware/policy-middleware'
import { loadStatWithAlias } from './common'
import { putDocs } from './docs'

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

    const existingPlayerStat = await em.repo(PlayerGameStat).findOne({
      player: alias.player,
      stat,
    })

    if (
      existingPlayerStat &&
      differenceInSeconds(new Date(), existingPlayerStat.updatedAt) < stat.minTimeBetweenUpdates
    ) {
      return {
        status: 400,
        body: {
          message: `Stat cannot be updated more often than every ${stat.minTimeBetweenUpdates} seconds`,
        },
      }
    }

    if (Math.abs(change) > (stat.maxChange ?? Infinity)) {
      return {
        status: 400,
        body: {
          message: `Stat change cannot be more than ${stat.maxChange}`,
        },
      }
    }

    const currentValue = existingPlayerStat?.value ?? stat.defaultValue

    if (currentValue + change < (stat.minValue ?? -Infinity)) {
      return {
        status: 400,
        body: {
          message: `Stat would go below the minValue of ${stat.minValue}`,
        },
      }
    }

    if (currentValue + change > (stat.maxValue ?? Infinity)) {
      return {
        status: 400,
        body: {
          message: `Stat would go above the maxValue of ${stat.maxValue}`,
        },
      }
    }

    const newValue = currentValue + change
    const now = new Date()
    const createdAt = continuityDate ?? now

    // upsert - on conflict, add the change to the existing value
    await em
      .qb(PlayerGameStat)
      .insert({
        player: alias.player.id,
        stat: stat.id,
        value: newValue,
        createdAt,
        updatedAt: now,
      })
      .onConflict(['player_id', 'stat_id'])
      .merge({ value: raw('player_game_stat.value + ?', [change]), updatedAt: now })
      .execute()

    const refreshedPlayerStat = await em
      .repo(PlayerGameStat)
      .findOne({ player: alias.player, stat }, { refresh: true })

    assert(refreshedPlayerStat)

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
