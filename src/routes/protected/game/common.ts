import { ProtectedRouteContext } from '../../../lib/routing/context'
import { Next } from 'koa'
import Game from '../../../entities/game'

type GameRouteContext = ProtectedRouteContext<{ game: Game }>

export const loadGame = async (ctx: GameRouteContext, next: Next) => {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const game = await em.repo(Game).findOne(
    { id: Number(id) },
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
