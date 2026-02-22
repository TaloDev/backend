import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { uniqWith } from 'lodash'
import { APIKeyScope } from '../../../entities/api-key'
import GameSave from '../../../entities/game-save'
import Integration from '../../../entities/integration'
import Player from '../../../entities/player'
import PlayerAlias from '../../../entities/player-alias'
import PlayerGameStat from '../../../entities/player-game-stat'
import triggerIntegrations from '../../../lib/integrations/triggerIntegrations'
import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { mergeDocs } from './docs'

async function findMergeAliasServiceConflicts(em: EntityManager, player1: Player, player2: Player) {
  const player1Aliases = await em
    .repo(PlayerAlias)
    .find({ player: player1 }, { fields: ['service'] })

  const player2Aliases = await em
    .repo(PlayerAlias)
    .find({ player: player2 }, { fields: ['service'] })

  const player1Services = new Set(player1Aliases.map((a) => a.service))
  const player2Services = new Set(player2Aliases.map((a) => a.service))

  return player1Services.intersection(player2Services)
}

function mergeProps(em: EntityManager, player1: Player, player2: Player) {
  const player1Props = player1.props.getItems().map(({ key, value }) => ({ key, value }))
  const player2Props = player2.props.getItems().map(({ key, value }) => ({ key, value }))
  const mergedProps = uniqWith([...player2Props, ...player1Props], (a, b) => a.key === b.key)

  em.remove(player1.props)
  em.remove(player2.props)
  player1.setProps(mergedProps)
}

async function mergePlayerStats(em: EntityManager, player1: Player, player2: Player) {
  const player1Stats = await em.repo(PlayerGameStat).find({ player: player1 })
  const player2Stats = await em.repo(PlayerGameStat).find({ player: player2 })

  const player1StatsMap = new Map(player1Stats.map((pgs) => [pgs.stat.internalName, pgs]))
  const player2StatsMap = new Map(player2Stats.map((pgs) => [pgs.stat.internalName, pgs]))

  const statsToTransfer: PlayerGameStat[] = []

  for (const [statName, player2Stat] of player2StatsMap.entries()) {
    const player1Stat = player1StatsMap.get(statName)
    if (player1Stat) {
      const maxValue = player1Stat.stat.maxValue ?? Infinity
      const minValue = player1Stat.stat.minValue ?? -Infinity
      player1Stat.value = Math.max(
        Math.min(player1Stat.value + player2Stat.value, maxValue),
        minValue,
      )

      em.remove(player2Stat)
    } else {
      statsToTransfer.push(player2Stat)
    }
  }

  await em
    .repo(PlayerGameStat)
    .nativeUpdate({ id: statsToTransfer.map((s) => s.id) }, { player: player1 })
}

export const mergeRoute = apiRoute({
  method: 'post',
  path: '/merge',
  docs: mergeDocs,
  schema: (z) => ({
    body: z.object({
      playerId1: z.uuid().meta({
        description: 'The first player ID - the second player will be merged into this player',
      }),
      playerId2: z.uuid().meta({ description: 'The second player ID' }),
    }),
  }),
  middleware: withMiddleware(requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])),
  handler: async (ctx) => {
    const { playerId1, playerId2 } = ctx.state.validated.body
    const em = ctx.em.fork()

    if (playerId1 === playerId2) {
      return ctx.throw(400, 'Cannot merge a player into itself')
    }

    const key = ctx.state.key

    const player1 = await em.repo(Player).findOne(
      {
        id: playerId1,
        game: key.game,
      },
      {
        populate: ['auth'],
      },
    )

    if (!player1) {
      return ctx.throw(404, `Player ${playerId1} does not exist`)
    }
    if (player1.auth) {
      return ctx.throw(400, `Player ${playerId1} has authentication enabled and cannot be merged`)
    }

    const player2 = await em.repo(Player).findOne(
      {
        id: playerId2,
        game: key.game,
      },
      {
        populate: ['auth'],
      },
    )

    if (!player2) {
      return ctx.throw(404, `Player ${playerId2} does not exist`)
    }
    if (player2.auth) {
      return ctx.throw(400, `Player ${playerId2} has authentication enabled and cannot be merged`)
    }

    const sharedServices = await findMergeAliasServiceConflicts(em, player1, player2)
    if (sharedServices.size > 0) {
      return ctx.throw(
        400,
        `Cannot merge players: both players have aliases with the following service(s): ${Array.from(sharedServices).join(', ')}`,
      )
    }

    const updatedPlayer = await em.transactional(async (trx) => {
      mergeProps(trx, player1, player2)
      await mergePlayerStats(trx, player1, player2)

      await trx.repo(GameSave).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(PlayerAlias).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(Player).nativeDelete(player2)

      await ctx.clickhouse.command({
        query: 'DELETE FROM player_sessions WHERE player_id = {playerId:String}',
        query_params: { playerId: player2.id },
      })

      return player1
    })

    // sync all stats for the updated player
    const playerStats = await em.repo(PlayerGameStat).find({ player: updatedPlayer })
    await triggerIntegrations(em, ctx.state.game, async (integration) => {
      for (const playerStat of playerStats) {
        try {
          await integration.handleStatUpdated(em, playerStat)
        } catch (err) {
          captureException(err)
        }
      }
    })

    await em.populate(updatedPlayer, ['aliases'])

    return {
      status: 200,
      body: {
        player: updatedPlayer,
      },
    }
  },
})
