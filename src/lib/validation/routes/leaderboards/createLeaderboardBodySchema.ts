import { z } from 'zod'
import {
  LeaderboardRefreshInterval,
  LeaderboardSortMode,
} from '../../../../entities/leaderboard.js'

const sortModeValues = Object.values(LeaderboardSortMode).join(', ')
const refreshIntervalValues = Object.values(LeaderboardRefreshInterval).join(', ')

export function createLeaderboardBodySchema(zod: typeof z) {
  return zod.object({
    internalName: zod.string().meta({ description: 'The internal name of the leaderboard' }),
    name: zod.string().meta({ description: 'The display name of the leaderboard' }),
    sortMode: zod
      .enum(LeaderboardSortMode, {
        error: `Sort mode must be one of ${sortModeValues}`,
      })
      .meta({ description: 'How entries are sorted: asc or desc' }),
    unique: zod.boolean().meta({
      description: 'Whether each player can only have a single entry',
    }),
    refreshInterval: zod
      .enum(LeaderboardRefreshInterval, {
        error: `Refresh interval must be one of ${refreshIntervalValues}`,
      })
      .optional()
      .meta({
        description: 'How often the leaderboard resets: never, daily, weekly, monthly or yearly',
      }),
    uniqueByProps: zod.boolean().optional().meta({
      description: 'Whether entries are unique based on their props',
    }),
  })
}
