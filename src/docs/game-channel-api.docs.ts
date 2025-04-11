import GameChannelAPIService from '../services/api/game-channel-api.service'
import APIDocs from './api-docs'

const GameChannelAPIDocs: APIDocs<GameChannelAPIService> = {
  index: {
    description: 'List game channels',
    params: {
      query: {
        page: 'The current pagination index (starting at 0)'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          channels: [
            {
              id: 1,
              name: 'general-chat',
              owner: null,
              totalMessages: 308,
              memberCount: 42,
              props: [
                { key: 'channelType', value: 'public' }
              ],
              autoCleanup: false,
              private: false,
              createdAt: '2024-12-09T12:00:00.000Z',
              updatedAt: '2024-12-09T12:00:00.000Z'
            },
            {
              id: 2,
              name: 'guild-chat',
              owner: {
                id: 105,
                service: 'username',
                identifier: 'johnny_the_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2024-10-25T18:18:28.000Z',
                  lastSeenAt: '2024-12-04T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2024-12-04T07:15:13.000Z',
                createdAt: '2024-10-25T18:18:28.000Z',
                updatedAt: '2024-12-04T07:15:13.000Z'
              },
              totalMessages: 36,
              memberCount: 8,
              props: [
                { key: 'channelType', value: 'guild' },
                { key: 'guildId', value: '5912' }
              ],
              autoCleanup: true,
              private: false,
              createdAt: '2024-12-09T12:00:00.000Z',
              updatedAt: '2024-12-09T12:00:00.000Z'
            }
          ],
          count: 2,
          itemsPerPage: 50,
          isLastPage: true
        }
      }
    ]
  },
  get: {
    description: 'Find a game channel',
    params: {
      route: {
        id: 'The ID of the channel'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          channel: {
            id: 1,
            name: 'general-chat',
            owner: null,
            totalMessages: 308,
            memberCount: 42,
            props: [
              { key: 'channelType', value: 'public' }
            ],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z'
          }
        }
      }
    ]
  },
  subscriptions: {
    description: 'List game channels that the player is subscribed to',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          channels: [
            {
              id: 1,
              name: 'general-chat',
              owner: null,
              totalMessages: 308,
              memberCount: 42,
              props: [
                { key: 'channelType', value: 'public' }
              ],
              autoCleanup: false,
              private: false,
              createdAt: '2024-12-09T12:00:00.000Z',
              updatedAt: '2024-12-09T12:00:00.000Z'
            },
            {
              id: 2,
              name: 'trade-chat',
              owner: null,
              totalMessages: 23439,
              memberCount: 124,
              props: [
                { key: 'channelType', value: 'public' }
              ],
              autoCleanup: false,
              private: false,
              createdAt: '2024-12-09T12:00:00.000Z',
              updatedAt: '2024-12-09T12:00:00.000Z'
            }
          ]
        }
      }
    ]
  },
  post: {
    description: 'Create a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      body: {
        name: 'The name of the channel',
        props: 'An array of @type(Props:prop)',
        autoCleanup: 'Whether the channel should be automatically deleted when the owner leaves or the channel is empty (default is false)',
        private: 'Private channels require invites to join them (default is false)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          name: 'guild-chat',
          props: [
            { key: 'channelType', value: 'guild' },
            { key: 'guildId', value: '5912' }
          ],
          autoCleanup: true,
          private: false
        }
      },
      {
        title: 'Sample response',
        sample: {
          channel: {
            id: 1,
            name: 'guild-chat',
            owner: {
              id: 105,
              service: 'username',
              identifier: 'johnny_the_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2024-10-25T18:18:28.000Z',
                lastSeenAt: '2024-12-04T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2024-12-04T07:15:13.000Z',
              createdAt: '2024-10-25T18:18:28.000Z',
              updatedAt: '2024-12-04T07:15:13.000Z'
            },
            totalMessages: 0,
            memberCount: 1,
            props: [
              { key: 'channelType', value: 'guild' },
              { key: 'guildId', value: '5912' }
            ],
            autoCleanup: true,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z'
          }
        }
      }
    ]
  },
  join: {
    description: 'Join a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          channel: {
            id: 1,
            name: 'general-chat',
            owner: null,
            totalMessages: 308,
            memberCount: 42,
            props: [
              { key: 'channelType', value: 'public' }
            ],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z'
          }
        }
      }
    ]
  },
  leave: {
    description: 'Leave a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      }
    }
  },
  put: {
    description: 'Update a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      body: {
        name: 'The new name of the channel',
        props: 'An array of @type(Props:prop)',
        ownerAliasId: 'The ID of the new owner of the channel'
      },
      route: {
        id: 'The ID of the channel'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          name: 'new-general-chat',
          props: [
            { key: 'channelType', value: 'public' },
            { key: 'recentlyUpdated', value: 'true' }
          ],
          ownerAliasId: 2
        }
      },
      {
        title: 'Sample response',
        sample: {
          channel: {
            id: 1,
            name: 'new-general-chat',
            owner: {
              id: 2,
              service: 'username',
              identifier: 'general_chat_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2024-10-25T18:18:28.000Z',
                lastSeenAt: '2024-12-04T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2024-12-04T07:15:13.000Z',
              createdAt: '2024-10-25T18:18:28.000Z',
              updatedAt: '2024-12-04T07:15:13.000Z'
            },
            totalMessages: 308,
            memberCount: 42,
            props: [
              { key: 'channelType', value: 'public' },
              { key: 'recentlyUpdated', value: 'true' }
            ],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:01:00.000Z'
          }
        }
      }
    ]
  },
  delete: {
    description: 'Delete a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      }
    }
  },
  invite: {
    description: 'Invite another player to a game channel',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      },
      body: {
        inviteeAliasId: 'The ID of the player alias to invite'
      }
    }
  }
}

export default GameChannelAPIDocs
