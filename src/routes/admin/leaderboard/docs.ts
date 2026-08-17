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

const entrySample = {
  position: 0,
  id: 4,
  score: 593.21,
  leaderboardName: 'Highscore',
  leaderboardInternalName: 'highscore',
  leaderboardSortMode: 'asc',
  playerAlias: {
    id: 1,
    service: 'steam',
    identifier: '11133645',
    displayName: '11133645',
    player: {
      id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
      props: [],
      aliases: ['/* [Circular] */'],
      devBuild: false,
      createdAt: '2026-08-01T13:20:32.133Z',
      lastSeenAt: '2026-08-15T15:09:43.066Z',
    },
    lastSeenAt: '2026-08-15T15:09:43.066Z',
    createdAt: '2026-08-01T13:20:32.133Z',
    updatedAt: '2026-08-01T13:20:32.133Z',
  },
  hidden: false,
  props: [],
  createdAt: '2026-08-02T14:01:18.727Z',
  updatedAt: '2026-08-02T14:01:18.727Z',
  deletedAt: null,
}

export const entriesDocs = {
  description: "List a leaderboard's entries\n50 results are returned per page",
  samples: [
    {
      title: 'Sample response',
      sample: {
        entries: [entrySample],
        count: 1,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with filters',
      sample: {
        url: '/admin/v1/leaderboards/4/entries?page=0&withDeleted=1&propKey=team',
        query: {
          page: 0,
          withDeleted: '1',
          propKey: 'team',
        },
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
