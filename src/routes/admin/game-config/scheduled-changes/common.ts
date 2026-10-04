import { Next } from 'koa'
import ScheduledGameConfigChange from '../../../../entities/scheduled-game-config-change.js'
import { AdminAPIRouteContext } from '../../../../lib/routing/context.js'

type AdminScheduledGameConfigChangeRouteState = {
  scheduledGameConfigChange: ScheduledGameConfigChange
}

export async function loadScheduledGameConfigChange(
  ctx: AdminAPIRouteContext<AdminScheduledGameConfigChangeRouteState>,
  next: Next,
) {
  const { changeId } = ctx.params as { changeId: string }

  const scheduledGameConfigChange = await ctx.em.repo(ScheduledGameConfigChange).findOne({
    id: Number(changeId),
    game: ctx.state.game,
  })

  if (!scheduledGameConfigChange) {
    return ctx.throw(404, 'Scheduled game config change not found')
  }

  ctx.state.scheduledGameConfigChange = scheduledGameConfigChange
  await next()
}
