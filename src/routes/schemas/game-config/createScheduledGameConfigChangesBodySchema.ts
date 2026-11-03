import { z } from 'zod'

export type ScheduledGameConfigChangesData = z.infer<
  ReturnType<typeof createScheduledGameConfigChangesBodySchema>
>

export function createScheduledGameConfigChangesBodySchema(zod: typeof z) {
  return zod.object({
    changes: zod
      .array(
        zod.object({
          key: zod.string().min(1),
          value: zod.string().nullable(),
          applyAt: zod.iso.datetime().refine((value) => new Date(value) > new Date(), {
            error: 'applyAt must be in the future',
          }),
        }),
      )
      .min(1),
  })
}
