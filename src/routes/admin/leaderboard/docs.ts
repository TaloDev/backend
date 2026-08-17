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

export const listDocs = {
  description: 'List all leaderboards',
  samples: [
    {
      title: 'Sample response',
      sample: {
        leaderboards: [
          leaderboardSample,
          {
            id: 7,
            internalName: 'time-survived',
            name: 'Time survived',
            sortMode: 'asc',
            unique: true,
            uniqueByProps: true,
            refreshInterval: 'daily',
            createdAt: '2026-08-15T12:50:21.803Z',
            updatedAt: '2026-08-15T12:52:47.511Z',
          },
        ],
      },
    },
    {
      title: 'Sample request with filter',
      sample: {
        url: '/admin/v1/leaderboards?internalName=highscores',
        query: {
          internalName: 'highscores',
        },
      },
    },
  ],
} satisfies RouteDocs
