import SocketTicketAPIService from '../services/api/socket-ticket-api.service'
import APIDocs from './api-docs'

const SocketTicketAPIDocs: APIDocs<SocketTicketAPIService> = {
  post: {
    description: 'Create a socket ticket (expires after 5 minutes)',
    samples: [
      {
        title: 'Sample response',
        sample: {
          ticket: '6c6ef345-0ac3-4edc-a221-b807fbbac4ac'
        }
      }
    ]
  }
}

export { SocketTicketAPIDocs }
