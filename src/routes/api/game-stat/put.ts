import { LockMode } from '@mikro-orm/mysql'
import { differenceInSeconds } from 'date-fns'
import { APIKeyScope } from '../../../entities/api-key'
import GameStat from '../../../entities/game-stat'
import PlayerGameStat from '../../../entities/player-game-stat'
import PlayerGameStatSnapshot from '../../../entities/player-game-stat-snapshot'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
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

    type PutTransactionResponse = [
      PlayerGameStat | null,
      { status: number; body: { message: string } } | null,
    ]

    const [playerStat, errorResponse] = await em.transactional(
      async (trx): Promise<PutTransactionResponse> => {
        const lockedStat = await trx
          .repo(GameStat)
          .findOneOrFail({ id: stat.id }, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true })

        let playerStat = await trx.repo(PlayerGameStat).findOne(
          {
            player: alias.player,
            stat: lockedStat,
          },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        )

        if (
          playerStat &&
          differenceInSeconds(new Date(), playerStat.updatedAt) < lockedStat.minTimeBetweenUpdates
        ) {
          return [
            null,
            {
              status: 400,
              body: {
                message: `Stat cannot be updated more often than every ${lockedStat.minTimeBetweenUpdates} seconds`,
              },
            },
          ]
        }

        if (Math.abs(change) > (lockedStat.maxChange ?? Infinity)) {
          return [
            null,
            {
              status: 400,
              body: {
                message: `Stat change cannot be more than ${lockedStat.maxChange}`,
              },
            },
          ]
        }

        const currentValue = playerStat?.value ?? lockedStat.defaultValue

        if (currentValue + change < (lockedStat.minValue ?? -Infinity)) {
          return [
            null,
            {
              status: 400,
              body: {
                message: `Stat would go below the minValue of ${lockedStat.minValue}`,
              },
            },
          ]
        }

        if (currentValue + change > (lockedStat.maxValue ?? Infinity)) {
          return [
            null,
            {
              status: 400,
              body: {
                message: `Stat would go above the maxValue of ${lockedStat.maxValue}`,
              },
            },
          ]
        }

        if (!playerStat) {
          playerStat = new PlayerGameStat(alias.player, lockedStat)
          if (continuityDate) {
            playerStat.createdAt = continuityDate
          }
          trx.persist(playerStat)
        }

        playerStat.value += change
        if (lockedStat.global) lockedStat.globalValue += change

        return [playerStat, null]
      },
    )

    if (errorResponse) {
      return errorResponse
    }

    if (playerStat) {
      await triggerIntegrations(em, playerStat.stat.game, (integration) => {
        return integration.handleStatUpdated(em, playerStat)
      })

      const snapshot = new PlayerGameStatSnapshot()
      snapshot.construct(alias, playerStat)
      snapshot.change = change
      if (continuityDate) {
        snapshot.createdAt = continuityDate
      }
      await getQueueHandler().add(snapshot)
    }

    return {
      status: 200,
      body: {
        playerStat,
      },
    }
  },
})
