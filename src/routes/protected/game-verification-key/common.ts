import { Next } from 'koa'
import GameVerificationKey from '../../../entities/game-verification-key.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

type VerificationKeyRouteContext = ProtectedRouteContext<
  GameRouteState & { verificationKey: GameVerificationKey }
>

export async function loadVerificationKey(ctx: VerificationKeyRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }

  const verificationKey = await ctx.em.repo(GameVerificationKey).findOne({
    id: Number(id),
    game: ctx.state.game,
  })

  if (!verificationKey) {
    return ctx.throw(404, 'Verification key not found')
  }

  ctx.state.verificationKey = verificationKey
  await next()
}
