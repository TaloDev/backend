import { Next } from 'koa'
import Player from '../../../entities/player'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type PlayerRouteContext = ProtectedRouteContext<
  GameRouteState & { player: Player }
>

export const loadPlayer = async (ctx: PlayerRouteContext, next: Next) => {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const player = await em.repo(Player).findOne({
    id,
    game: ctx.state.game
  }, {
    populate: ['aliases', 'game'],
    strategy: 'joined'
  })

  if (!player) {
    ctx.throw(404, 'Player not found')
  }

  ctx.state.player = player
  await next()
}
