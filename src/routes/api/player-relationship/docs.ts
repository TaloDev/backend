import { RouteDocs } from '../../../lib/docs/docs-registry'

export const postDocs = {
  description: 'Create a subscription request to another player',
  samples: [
    {
      title: 'Sample request',
      sample: {
        aliasId: 42,
        relationshipType: 'unidirectional'
      }
    },
    {
      title: 'Sample response',
      sample: {
        subscription: {
          id: '8f3e9a7b-4c2d-4a1e-9f8b-3c7d2e1a9b4c',
          subscriber: {
            id: 105,
            service: 'username',
            identifier: 'player_one',
            player: {
              id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
              props: [],
              devBuild: false,
              createdAt: '2025-11-05T10:30:00.000Z',
              lastSeenAt: '2025-11-09T14:22:00.000Z',
              groups: []
            },
            lastSeenAt: '2025-11-09T14:22:00.000Z',
            createdAt: '2025-11-05T10:30:00.000Z',
            updatedAt: '2025-11-09T14:22:00.000Z'
          },
          subscribedTo: {
            id: 42,
            service: 'username',
            identifier: 'player_two',
            player: {
              id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
              props: [],
              devBuild: false,
              createdAt: '2025-11-01T08:15:00.000Z',
              lastSeenAt: '2025-11-09T15:45:00.000Z',
              groups: []
            },
            lastSeenAt: '2025-11-09T15:45:00.000Z',
            createdAt: '2025-11-01T08:15:00.000Z',
            updatedAt: '2025-11-09T15:45:00.000Z'
          },
          confirmed: false,
          relationshipType: 'unidirectional',
          createdAt: '2025-11-09T16:00:00.000Z',
          updatedAt: '2025-11-09T16:00:00.000Z'
        }
      }
    }
  ]
} satisfies RouteDocs

export const confirmDocs = {
  description: 'Confirm a pending subscription request',
  samples: [
    {
      title: 'Sample response',
      sample: {
        subscription: {
          id: '7a2b8c9d-3e4f-5a6b-7c8d-9e0f1a2b3c4d',
          subscriber: {
            id: 108,
            service: 'username',
            identifier: 'subscriber_one',
            player: {
              id: 'b2c3d4e5-6789-01bc-def2-234567890abc',
              props: [],
              devBuild: false,
              createdAt: '2025-11-06T12:00:00.000Z',
              lastSeenAt: '2025-11-09T10:30:00.000Z',
              groups: []
            },
            lastSeenAt: '2025-11-09T10:30:00.000Z',
            createdAt: '2025-11-06T12:00:00.000Z',
            updatedAt: '2025-11-09T10:30:00.000Z'
          },
          subscribedTo: {
            id: 42,
            service: 'username',
            identifier: 'current_player',
            player: {
              id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
              props: [],
              devBuild: false,
              createdAt: '2025-11-01T08:15:00.000Z',
              lastSeenAt: '2025-11-09T15:45:00.000Z',
              groups: []
            },
            lastSeenAt: '2025-11-09T15:45:00.000Z',
            createdAt: '2025-11-01T08:15:00.000Z',
            updatedAt: '2025-11-09T15:45:00.000Z'
          },
          confirmed: true,
          relationshipType: 'bidirectional',
          createdAt: '2025-11-09T11:15:00.000Z',
          updatedAt: '2025-11-09T16:30:00.000Z'
        }
      }
    }
  ]
} satisfies RouteDocs

export const getSubscribersDocs = {
  description: 'List subscriptions from players who have subscribed to the current player',
  samples: [
    {
      title: 'Sample response',
      sample: {
        subscriptions: [
          {
            id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
            subscriber: {
              id: 108,
              service: 'username',
              identifier: 'subscriber_one',
              player: {
                id: 'b2c3d4e5-6789-01bc-def2-234567890abc',
                props: [],
                devBuild: false,
                createdAt: '2025-11-06T12:00:00.000Z',
                lastSeenAt: '2025-11-09T10:30:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T10:30:00.000Z',
              createdAt: '2025-11-06T12:00:00.000Z',
              updatedAt: '2025-11-09T10:30:00.000Z'
            },
            subscribedTo: {
              id: 42,
              service: 'username',
              identifier: 'current_player',
              player: {
                id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
                props: [],
                devBuild: false,
                createdAt: '2025-11-01T08:15:00.000Z',
                lastSeenAt: '2025-11-09T15:45:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T15:45:00.000Z',
              createdAt: '2025-11-01T08:15:00.000Z',
              updatedAt: '2025-11-09T15:45:00.000Z'
            },
            confirmed: true,
            relationshipType: 'unidirectional',
            createdAt: '2025-11-09T10:30:00.000Z',
            updatedAt: '2025-11-09T10:30:00.000Z'
          },
          {
            id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
            subscriber: {
              id: 109,
              service: 'username',
              identifier: 'subscriber_two',
              player: {
                id: 'c3d4e5f6-7890-12cd-ef34-567890abcdef',
                props: [],
                devBuild: false,
                createdAt: '2025-11-07T09:45:00.000Z',
                lastSeenAt: '2025-11-09T13:20:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T13:20:00.000Z',
              createdAt: '2025-11-07T09:45:00.000Z',
              updatedAt: '2025-11-09T13:20:00.000Z'
            },
            subscribedTo: {
              id: 42,
              service: 'username',
              identifier: 'current_player',
              player: {
                id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
                props: [],
                devBuild: false,
                createdAt: '2025-11-01T08:15:00.000Z',
                lastSeenAt: '2025-11-09T15:45:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T15:45:00.000Z',
              createdAt: '2025-11-01T08:15:00.000Z',
              updatedAt: '2025-11-09T15:45:00.000Z'
            },
            confirmed: true,
            relationshipType: 'bidirectional',
            createdAt: '2025-11-09T13:20:00.000Z',
            updatedAt: '2025-11-09T13:20:00.000Z'
          }
        ],
        count: 2,
        itemsPerPage: 50,
        isLastPage: true
      }
    }
  ]
} satisfies RouteDocs

export const getSubscriptionsDocs = {
  description: 'List subscriptions where the current player is the subscriber',
  samples: [
    {
      title: 'Sample response',
      sample: {
        subscriptions: [
          {
            id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
            subscriber: {
              id: 105,
              service: 'username',
              identifier: 'current_player',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-11-05T10:30:00.000Z',
                lastSeenAt: '2025-11-09T14:22:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T14:22:00.000Z',
              createdAt: '2025-11-05T10:30:00.000Z',
              updatedAt: '2025-11-09T14:22:00.000Z'
            },
            subscribedTo: {
              id: 42,
              service: 'username',
              identifier: 'player_two',
              player: {
                id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
                props: [],
                devBuild: false,
                createdAt: '2025-11-01T08:15:00.000Z',
                lastSeenAt: '2025-11-09T15:45:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T15:45:00.000Z',
              createdAt: '2025-11-01T08:15:00.000Z',
              updatedAt: '2025-11-09T15:45:00.000Z'
            },
            confirmed: true,
            relationshipType: 'unidirectional',
            createdAt: '2025-11-09T11:00:00.000Z',
            updatedAt: '2025-11-09T11:00:00.000Z'
          },
          {
            id: '4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
            subscriber: {
              id: 105,
              service: 'username',
              identifier: 'current_player',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-11-05T10:30:00.000Z',
                lastSeenAt: '2025-11-09T14:22:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T14:22:00.000Z',
              createdAt: '2025-11-05T10:30:00.000Z',
              updatedAt: '2025-11-09T14:22:00.000Z'
            },
            subscribedTo: {
              id: 43,
              service: 'username',
              identifier: 'player_three',
              player: {
                id: 'e5f6a7b8-9012-34ef-5678-90abcdef1234',
                props: [],
                devBuild: false,
                createdAt: '2025-11-02T10:30:00.000Z',
                lastSeenAt: '2025-11-09T14:15:00.000Z',
                groups: []
              },
              lastSeenAt: '2025-11-09T14:15:00.000Z',
              createdAt: '2025-11-02T10:30:00.000Z',
              updatedAt: '2025-11-09T14:15:00.000Z'
            },
            confirmed: false,
            relationshipType: 'bidirectional',
            createdAt: '2025-11-09T12:15:00.000Z',
            updatedAt: '2025-11-09T12:15:00.000Z'
          }
        ],
        count: 2,
        itemsPerPage: 50,
        isLastPage: true
      }
    }
  ]
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a subscription (unsubscribe from a player)'
} satisfies RouteDocs
