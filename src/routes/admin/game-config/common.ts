import { Next } from 'koa'
import { AdminAPIRouteContext } from '../../../lib/routing/context.js'

// the admin API key middleware excludes game.props from the cached key query,
// so reload the game with its props for routes that read or write the live config
export async function loadGameConfig(ctx: AdminAPIRouteContext, next: Next) {
  ctx.state.game = await ctx.em.refreshOrFail(ctx.state.game)

  await next()
}
