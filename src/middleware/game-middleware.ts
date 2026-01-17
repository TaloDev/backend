import { Next } from 'koa'
import Game from '../entities/game'
import { ProtectedRouteContext } from '../lib/routing/context'

export type GameRouteState = { game: Game }
type GameRouteContext = ProtectedRouteContext<GameRouteState>

export const loadGame = async (ctx: GameRouteContext, next: Next) => {
  const { gameId } = ctx.params as { gameId: string }
  const em = ctx.em

  const game = await em.repo(Game).findOne(
    { id: Number(gameId) },
    { populate: ['organisation'] }
  )

  if (!game) {
    ctx.throw(404, 'Game not found')
  }

  const userOrganisation = ctx.state.authenticatedUser.organisation
  if (game.organisation.id !== userOrganisation.id) {
    ctx.throw(403, 'Forbidden')
  }

  ctx.state.game = game
  await next()
}
