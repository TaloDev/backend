import GameStatAPIService from '../services/api/game-stat-api.service'
import APIDocs from './api-docs'

const GameStatAPIDocs: APIDocs<GameStatAPIService> = {
  put: {
    description: 'Update a stat value',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player'
      },
      body: {
        change: 'The amount to add to the current value of the stat (can be negative)'
      },
      route: {
        internalName: 'The internal name of the stat'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          change: 47
        }
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
              maxChange: Infinity,
              minValue: 0,
              maxValue: Infinity,
              minTimeBetweenUpdates: 5,
              createdAt: '2021-12-24T12:45:39.409Z',
              updatedAt: '2021-12-24T12:49:14.315Z'
            },
            value: 52,
            createdAt: '2022-01-01T06:18:11.881Z',
            updatedAt: '2022-01-03T08:32:46.123Z'
          }
        }
      }
    ]
  },
  history: {
    description: 'Get a history of changes to a player stat',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player'
      },
      route: {
        internalName: 'The internal name of the stat'
      },
      query: {
        page: 'The current pagination index (starting at 0)',
        startDate: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
        endDate: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          history: [
            {
              change: 2,
              value: 1064,
              globalValue: 1064,
              createdAt: '2025-03-19T00:56:40.019Z'
            },
            {
              change: 1,
              value: 1062,
              globalValue: 1062,
              createdAt: '2025-03-19T00:56:36.774Z'
            },
            {
              change: 18,
              value: 1061,
              globalValue: 1061,
              createdAt: '2025-03-19T00:55:27.003Z'
            },
            {
              change: 15,
              value: 1043,
              globalValue: 1043,
              createdAt: '2025-03-19T00:55:21.252Z'
            },
            {
              change: 15,
              value: 1028,
              globalValue: 1028,
              createdAt: '2025-03-18T21:17:08.516Z'
            }
          ],
          count: 5,
          itemsPerPage: 50,
          isLastPage: true
        }
      },
      {
        title: 'Sample request with filtering',
        sample: {
          url: '/v1/game-stats/gold-collected/history?page=0&startDate=2025-03-19&endDate=2025-03-19T00%3A56%3A00.000Z',
          query: {
            page: '0',
            startDate: '2025-03-19',
            endDate: '2025-03-19T00:56:00.000Z'
          }
        }
      }
    ]
  }
}

export default GameStatAPIDocs
