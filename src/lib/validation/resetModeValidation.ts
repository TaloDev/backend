import { z } from 'zod'

export const resetModes = ['all', 'live', 'dev'] as const

export type ResetMode = (typeof resetModes)[number]

export const resetModeQuerySchema = z.object({
  mode: z
    .enum(resetModes, {
      error: `Mode must be one of: ${resetModes.join(', ')}`,
    })
    .optional()
    .default('all')
    .meta({ description: 'Which players to reset: all, live or dev' }),
})

export function translateResetMode(resetMode: ResetMode) {
  switch (resetMode) {
    case 'all':
      return 'All players'
    case 'live':
      return 'Live players'
    case 'dev':
      return 'Dev players'
  }
}
