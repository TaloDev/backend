import EventAPIService from '../services/api/event-api.service.js'
import APIDocs from './api-docs.js'

const EventAPIDocs: APIDocs<EventAPIService> = {
  post: {
    description: 'Track events',
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
            { name: 'Quested started', timestamp: 1657063169819, props: [{ key: 'questId', value: '128' }] }
          ]
        }
      },
      {
        title: 'Sample response',
        sample: {
          events: [
            { name: 'Levelled up', timestamp: 1657063169020, props: [{ key: 'newLevel', value: '81' }] },
            { name: 'Quest completed', timestamp: 1657063169324, props: [{ key: 'questId', value: '122' }] }
          ],
          errors: [
            'Event is missing the key: timestamp'
          ]
        }
      }
    ]
  }
}

export default EventAPIDocs
