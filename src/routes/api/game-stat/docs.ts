import { RouteDocs } from '../../../lib/docs/docs-registry'

export const indexDocs = {
  description: 'Get all game stats',
  samples: [
    {
      title: 'Sample response',
      sample: {
        stats: [
          {
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
            createdAt: '2021-12-24T12:45:39.409Z',
            updatedAt: '2021-12-24T12:49:14.315Z',
          },
          {
            id: 7,
            internalName: 'silver-collected',
            name: 'Silver collected',
            global: true,
            globalValue: 15874,
            defaultValue: 0,
            maxChange: null,
            minValue: 0,
            maxValue: null,
            minTimeBetweenUpdates: 5,
            createdAt: '2021-12-24T12:45:39.409Z',
            updatedAt: '2021-12-24T12:49:14.315Z',
          },
        ],
      },
    },
  ],
} satisfies RouteDocs

export const getDocs = {
  description: 'Get an individual game stat',
  samples: [
    {
      title: 'Sample response',
      sample: {
        stat: {
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
          createdAt: '2021-12-24T12:45:39.409Z',
          updatedAt: '2021-12-24T12:49:14.315Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const getPlayerStatDocs = {
  description: "Get the current value of a player's stat",
  samples: [
    {
      title: 'Sample response',
      sample: {
        playerStat: {
          id: 15,
          stat: {
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
            createdAt: '2021-12-24T12:45:39.409Z',
            updatedAt: '2021-12-24T12:49:14.315Z',
          },
          value: 52,
          createdAt: '2025-06-19T06:18:11.881Z',
          updatedAt: '2025-06-19T08:32:46.123Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const putDocs = {
  description: 'Update a stat value',
  samples: [
    {
      title: 'Sample request',
      sample: {
        change: 47,
      },
    },
    {
      title: 'Sample response',
      sample: {
        playerStat: {
          id: 15,
          stat: {
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
            createdAt: '2021-12-24T12:45:39.409Z',
            updatedAt: '2021-12-24T12:49:14.315Z',
          },
          value: 52,
          createdAt: '2022-01-01T06:18:11.881Z',
          updatedAt: '2022-01-03T08:32:46.123Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const historyDocs = {
  description: 'Get a history of changes to a player stat',
  samples: [
    {
      title: 'Sample response',
      sample: {
        history: [
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'jonas',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 2,
            value: 1064,
            globalValue: 1064,
            createdAt: '2025-03-19T00:56:40.019Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'jonas',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 1,
            value: 1062,
            globalValue: 1062,
            createdAt: '2025-03-19T00:56:36.774Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'jonas',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 18,
            value: 1061,
            globalValue: 1061,
            createdAt: '2025-03-19T00:55:27.003Z',
          },
        ],
        count: 3,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with filtering',
      sample: {
        url: '/v1/game-stats/gold-collected/history?page=0&startDate=2025-03-19&endDate=2025-03-19T00%3A56%3A00.000Z',
        query: {
          page: '0',
          startDate: '2025-03-19',
          endDate: '2025-03-19T00:56:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const globalHistoryDocs = {
  description: 'Get a history of changes to a global stat',
  samples: [
    {
      title: 'Sample response',
      sample: {
        history: [
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'jonas',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 2,
            value: 1064,
            globalValue: 1064,
            createdAt: '2025-03-19T00:56:40.019Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'joe',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 1,
            value: 1062,
            globalValue: 1062,
            createdAt: '2025-03-19T00:56:36.774Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'bob',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 18,
            value: 1061,
            globalValue: 1061,
            createdAt: '2025-03-19T00:55:27.003Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'jim',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 15,
            value: 1043,
            globalValue: 1043,
            createdAt: '2025-03-19T00:55:21.252Z',
          },
          {
            playerAlias: {
              id: 79,
              service: 'username',
              identifier: 'billy',
              player: {
                id: '19750d91-92b2-4dbb-a4b2-e9827751e929',
                props: [],
                devBuild: false,
                createdAt: '2025-03-13T20:09:09.000Z',
                lastSeenAt: '2025-03-13T20:09:09.000Z',
                groups: [],
                presence: null,
              },
              lastSeenAt: '2025-03-13T20:09:09.000Z',
              createdAt: '2025-03-13T20:09:09.000Z',
              updatedAt: '2025-03-13T20:09:09.000Z',
            },
            change: 15,
            value: 1028,
            globalValue: 1028,
            createdAt: '2025-03-18T21:17:08.516Z',
          },
        ],
        globalValue: {
          minValue: 1028,
          maxValue: 1062,
          medianValue: 1052,
          averageValue: 1048.5,
          averageChange: 8.6,
        },
        playerValue: {
          minValue: 1028,
          maxValue: 1062,
          medianValue: 1052,
          averageValue: 1051.6,
        },
        count: 5,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with filtering',
      sample: {
        url: '/v1/game-stats/gold-collected/history?page=0&startDate=2025-03-19&endDate=2025-03-19T00%3A56%3A00.000Z&playerId=550e8400-e29b-41d4-a716-446655440000',
        query: {
          page: '0',
          startDate: '2025-03-19',
          endDate: '2025-03-19T00:56:00.000Z',
          playerId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  ],
} satisfies RouteDocs

export const listPlayerStatsDocs = {
  description: "Get the current values of all the player's stats",
  samples: [
    {
      title: 'Sample response',
      sample: {
        playerStats: [
          {
            id: 15,
            stat: {
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
              createdAt: '2021-12-24T12:45:39.409Z',
              updatedAt: '2021-12-24T12:49:14.315Z',
            },
            value: 52,
            createdAt: '2025-06-19T06:18:11.881Z',
            updatedAt: '2025-06-19T08:32:46.123Z',
          },
          {
            id: 16,
            stat: {
              id: 7,
              internalName: 'silver-collected',
              name: 'Silver collected',
              global: true,
              globalValue: 15874,
              defaultValue: 0,
              maxChange: null,
              minValue: 0,
              maxValue: null,
              minTimeBetweenUpdates: 5,
              createdAt: '2021-12-24T12:45:39.409Z',
              updatedAt: '2021-12-24T12:49:14.315Z',
            },
            value: 152,
            createdAt: '2025-06-19T06:18:11.881Z',
            updatedAt: '2025-06-19T08:32:46.123Z',
          },
        ],
      },
    },
  ],
} satisfies RouteDocs
