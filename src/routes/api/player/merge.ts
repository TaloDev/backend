import { EntityManager } from '@mikro-orm/mysql'
import { uniqWith } from 'lodash'
import { APIKeyScope } from '../../../entities/api-key'
import GameSave from '../../../entities/game-save'
import Player from '../../../entities/player'
import PlayerAlias from '../../../entities/player-alias'
import PlayerGameStat from '../../../entities/player-game-stat'
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
      const player1Props = player1.props.getItems().map(({ key, value }) => ({ key, value }))
      const player2Props = player2.props.getItems().map(({ key, value }) => ({ key, value }))
      const mergedProps = uniqWith([...player2Props, ...player1Props], (a, b) => a.key === b.key)

      trx.remove(player1.props)
      trx.remove(player2.props)
      player1.setProps(mergedProps)

      await trx.repo(PlayerAlias).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(GameSave).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(PlayerGameStat).nativeUpdate({ player: player2 }, { player: player1 })
      await trx.repo(Player).nativeDelete(player2)

      await ctx.clickhouse.exec({
        query: 'DELETE FROM player_sessions WHERE player_id = {playerId:String}',
        query_params: { playerId: player2.id },
      })
      return player1
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
