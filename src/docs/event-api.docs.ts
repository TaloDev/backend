import EventAPIService from '../services/api/event-api.service'
import APIDocs from './api-docs'

const EventAPIDocs: APIDocs<EventAPIService> = {
  post: {
    description: 'Track events',
    params: {
      body: {
        events: 'An array of @type(EventData:eventdata)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          events: [
            { aliasId: 1, name: 'Levelled up', timestamp: 1657063169020, props: [{ key: 'newLevel', value: '81' }] },
            { aliasId: 1, name: 'Quest completed', timestamp: 1657063169324, props: [{ key: 'questId', value: '122' }] },
            { aliasId: 1, name: 'Quested started', timestamp: 1657063169819, props: [{ key: 'questId', value: '128' }] }
          ]
        }
      },
      {
        title: 'Sample response',
        sample: {
          events: [
            { aliasId: 1, name: 'Levelled up', timestamp: 1657063169020, props: [{ key: 'newLevel', value: '81' }] },
            { aliasId: 1, name: 'Quest completed', timestamp: 1657063169324, props: [{ key: 'questId', value: '122' }] }
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
