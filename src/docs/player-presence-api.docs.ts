import PlayerPresenceAPIService from '../services/api/player-presence-api.service'
import APIDocs from './api-docs'

const PlayerPresenceAPIDocs: APIDocs<PlayerPresenceAPIService> = {
  get: {
    description: 'Get a player\'s online status and custom status',
    params: {
      route: {
        id: 'The ID of the player'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          presence: {
            online: true,
            customStatus: 'I\'m loving this game',
            playerAlias: {
              id: 1,
              service: 'username',
              identifier: 'jimbo',
              player: {
                id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                props: [
                  { key: 'currentLevel', value: '58' },
                  { key: 'xPos', value: '13.29' },
                  { key: 'yPos', value: '26.44' },
                  { key: 'zoneId', value: '3' }
                ],
                devBuild: false,
                createdAt: '2025-01-15T13:20:32.133Z',
                lastSeenAt: '2025-02-12T15:09:43.066Z',
                groups: []
              }
            },
            updatedAt: '2025-02-12T15:09:43.066Z'
          }
        }
      }
    ]
  },
  put: {
    description: 'Update a player\'s online status and custom status',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      body: {
        online: 'Whether the player is online',
        customStatus: 'A custom status message for the player'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          online: true,
          customStatus: 'In a match'
        }
      },
      {
        title: 'Sample response',
        sample: {
          presence: {
            online: true,
            customStatus: 'In a match',
            playerAlias: {
              id: 1,
              service: 'username',
              identifier: 'jimbo',
              player: {
                id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                props: [
                  { key: 'currentLevel', value: '58' },
                  { key: 'xPos', value: '13.29' },
                  { key: 'yPos', value: '26.44' },
                  { key: 'zoneId', value: '3' }
                ],
                devBuild: false,
                createdAt: '2025-01-15T13:20:32.133Z',
                lastSeenAt: '2025-02-12T15:09:43.066Z',
                groups: []
              }
            },
            updatedAt: '2025-02-12T15:09:43.066Z'
          }
        }
      }
    ]
  }
}

export default PlayerPresenceAPIDocs
