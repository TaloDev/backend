import { Next } from 'koa'
import { z as zod } from 'zod'
import ScheduledGameConfigChange from '../../../../entities/scheduled-game-config-change.js'
import { ProtectedRouteContext } from '../../../../lib/routing/context.js'
import { GameRouteState } from '../../../../middleware/game-middleware.js'

export type ScheduledGameConfigChangeRouteState = GameRouteState & {
  scheduledGameConfigChange: ScheduledGameConfigChange
}

type ScheduledGameConfigChangeRouteContext =
  ProtectedRouteContext<ScheduledGameConfigChangeRouteState>

export type ScheduledGameConfigChangesData = zod.infer<
  ReturnType<typeof createScheduledGameConfigChangesBodySchema>
>

export function createScheduledGameConfigChangesBodySchema(z: typeof zod) {
  return z.object({
    changes: z
      .array(
        z.object({
          key: z.string().min(1),
          value: z.string().nullable(),
          applyAt: z.iso.datetime().refine((value) => new Date(value) > new Date(), {
            error: 'applyAt must be in the future',
          }),
        }),
      )
      .min(1),
  })
}

export async function loadScheduledGameConfigChange(
  ctx: ScheduledGameConfigChangeRouteContext,
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
