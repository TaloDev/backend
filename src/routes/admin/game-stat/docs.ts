import { RouteDocs } from '../../../lib/docs/docs-registry.js'

const statSample = {
  id: 4,
  internalName: 'gold-collected',
  name: 'Gold collected',
  global: true,
  globalValue: 5839,
  defaultValue: 0,
  maxChange: null,
  minValue: 0,
  maxValue: null,
  minTimeBetweenUpdates: 5,
  createdAt: '2026-08-15T12:45:39.409Z',
  updatedAt: '2026-08-15T12:49:14.315Z',
}

const statWithMetricsSample = {
  ...statSample,
  metrics: {
    globalCount: 5,
    globalValue: {
      minValue: 5839,
      maxValue: 6052,
      medianValue: 5912,
      averageValue: 5934,
      averageChange: 42.6,
    },
    playerValue: {
      minValue: 5839,
      maxValue: 6052,
      medianValue: 5912,
      averageValue: 5934,
    },
  },
}

export const createDocs = {
  description: 'Create a game stat',
  samples: [
    {
      title: 'Sample request',
      sample: {
        internalName: 'gold-collected',
        name: 'Gold collected',
        global: true,
        defaultValue: 0,
        minTimeBetweenUpdates: 5,
      },
    },
    {
      title: 'Sample response',
      sample: {
        stat: statSample,
      },
    },
  ],
} satisfies RouteDocs

export const listDocs = {
  description: 'List all stats',
  samples: [
    {
      title: 'Sample response',
      sample: {
        stats: [
          statSample,
          {
            id: 7,
            internalName: 'silver-collected',
            name: 'Silver collected',
            global: true,
            globalValue: 15874,
            defaultValue: 0,
            maxChange: 99,
            minValue: 0,
            maxValue: 99,
            minTimeBetweenUpdates: 5,
            createdAt: '2026-08-15T12:50:21.803Z',
            updatedAt: '2026-08-15T12:52:47.511Z',
          },
        ],
      },
    },
    {
      title: 'Sample request with metrics',
      sample: {
        url: '/admin/v1/game-stats?withMetrics=1&metricsStartDate=2026-08-15&metricsEndDate=2026-08-15T00%3A56%3A00.000Z',
        query: {
          withMetrics: '1',
          metricsStartDate: '2026-08-15',
          metricsEndDate: '2026-08-15T00:56:00.000Z',
        },
      },
    },
    {
      title: 'Sample response with metrics',
      sample: {
        stats: [statWithMetricsSample],
      },
    },
  ],
} satisfies RouteDocs

export const findDocs = {
  description: 'Find a stat',
  samples: [
    {
      title: 'Sample response',
      sample: {
        stat: statSample,
      },
    },
    {
      title: 'Sample response with metrics',
      sample: {
        stat: statWithMetricsSample,
      },
    },
  ],
} satisfies RouteDocs

export const updateDocs = {
  description: 'Update a game stat',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: 'Gold collected',
        maxValue: 100000,
      },
    },
    {
      title: 'Sample response',
      sample: {
        stat: statSample,
      },
    },
  ],
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a game stat',
} satisfies RouteDocs

export const resetDocs = {
  description: 'Reset the player stats for a stat',
  samples: [
    {
      title: 'Sample request',
      sample: {
        url: '/admin/v1/game-stats/4/player-stats?mode=all',
        query: {
          mode: 'all',
        },
      },
    },
    {
      title: 'Sample response',
      sample: {
        deletedCount: 3,
      },
    },
  ],
} satisfies RouteDocs
