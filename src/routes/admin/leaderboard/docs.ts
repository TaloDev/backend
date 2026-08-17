import { RouteDocs } from '../../../lib/docs/docs-registry.js'

const leaderboardSample = {
  id: 4,
  internalName: 'highscores',
  name: 'Highscores',
  sortMode: 'desc',
  unique: true,
  uniqueByProps: false,
  refreshInterval: 'never',
  createdAt: '2026-08-15T12:45:39.409Z',
  updatedAt: '2026-08-15T12:49:14.315Z',
}

export const createDocs = {
  description: 'Create a leaderboard',
  samples: [
    {
      title: 'Sample request',
      sample: {
        internalName: 'highscores',
        name: 'Highscores',
        sortMode: 'desc',
        unique: true,
        refreshInterval: 'never',
      },
    },
    {
      title: 'Sample response',
      sample: {
        leaderboard: leaderboardSample,
      },
    },
  ],
} satisfies RouteDocs
