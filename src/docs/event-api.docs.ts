import EventAPIService from '../services/api/event-api.service'
import APIDocs from './api-docs'
import { APIKeyScope } from '../entities/api-key'

const EventAPIDocs: APIDocs<EventAPIService> = {
  post: {
    description: 'Track events',
    scopes: [APIKeyScope.WRITE_EVENTS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      body: {
        events: 'An array of @type(EventData:eventdata)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          events: [
            { name: 'Levelled up', timestamp: 1657063169020, props: [{ key: 'newLevel', value: '81' }] },
            { name: 'Quest completed', timestamp: 1657063169324, props: [{ key: 'questId', value: '122' }] },
            { name: 'Quested started', props: [{ key: 'questId', value: '128' }] }
          ]
        }
      },
      {
        title: 'Sample response',
        sample: {
          events: [
            {
              id: '77bdd78a-2292-40c0-8835-7e091adbced5',
              name: 'Levelled up',
              props: [{ key: 'newLevel', value: '81' }],
              playerAlias: {
                id: 1,
                service: 'steam',
                identifier: '11133645',
                player: {
                  id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                  props: [
                    { key: 'xPos', value: '13.29' },
                    { key: 'yPos', value: '26.44' }
                  ],
                  aliases: [
                    '/* [Circular] */'
                  ],
                  devBuild: false,
                  createdAt: '2022-01-15T13:20:32.133Z',
                  lastSeenAt: '2022-07-05T12:09:43.124Z'
                }
              },
              gameId: 1,
              createdAt: '2022-07-05T12:26:09.020Z'
            },
            {
              id: 'd58b8a63-525b-4994-b04c-602485976245',
              name: 'Quest completed',
              props: [{ key: 'questId', value: '122' }],
              playerAlias: {
                id: 1,
                service: 'steam',
                identifier: '11133645',
                player: {
                  id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                  props: [
                    { key: 'xPos', value: '13.29' },
                    { key: 'yPos', value: '26.44' }
                  ],
                  aliases: [
                    '/* [Circular] */'
                  ],
                  devBuild: false,
                  createdAt: '2022-01-15T13:20:32.133Z',
                  lastSeenAt: '2022-07-05T12:09:43.124Z'
                }
              },
              gameId: 1,
              createdAt: '2022-07-05T12:26:09.324Z'
            }
          ],
          errors: [
            [],
            [],
            ['Event is missing the key: timestamp']
          ]
        }
      }
    ]
  }
}

export { EventAPIDocs }
