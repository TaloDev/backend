import { RouteDocs } from 'koa-clay'

const GameStatAPIDocs: Record<string, RouteDocs> = {
  put: {
    description: 'Update a stat value',
    params: {
      body: {
        aliasId: 'The ID of the player\'s alias',
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
          aliasId: 1,
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
              createdAt: '2021-12-24 12:45:39',
              updatedAt: '2021-12-24 12:49:14'
            },
            value: 52,
            createdAt: '2022-01-01 06:18:11',
            updatedAt: '2022-01-03 08:32:46'
          }
        }
      }
    ]
  }
}

export default GameStatAPIDocs
