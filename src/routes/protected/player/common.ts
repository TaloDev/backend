import { Next } from 'koa'
import Player from '../../../entities/player.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

type PlayerRouteContext = ProtectedRouteContext<GameRouteState & { player: Player }>

export async function loadPlayer(ctx: PlayerRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const player = await em.repo(Player).findOne(
    {
      id,
      game: ctx.state.game,
    },
    {
      populate: ['aliases', 'game'],
      strategy: 'joined',
    },
  )

  if (!player) {
    return ctx.throw(404, 'Player not found')
  }

  ctx.state.player = player
  await next()
}
