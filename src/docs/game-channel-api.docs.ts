import GameChannelAPIService from '../services/api/game-channel-api.service'
import APIDocs from './api-docs'

const GameChannelAPIDocs: APIDocs<GameChannelAPIService> = {
  index: {
    description: 'List game channels',
    samples: [
      {
        title: 'Sample response',
        sample: {
          channels: [
            {
              id: 1,
              name: 'general-chat',
              ownerAliasId: null,
              totalMessages: 308,
              memberCount: 42,
              props: [
                { key: 'channelType', value: 'public' }
              ],
              createdAt: '2024-12-09T12:00:00Z',
              updatedAt: '2024-12-09T12:00:00Z'
            },
            {
              id: 2,
              name: 'guild-chat',
              ownerAliasId: 1,
              props: [
                { key: 'channelType', value: 'guild' },
                { key: 'guildId', value: '5912' }
              ],
              createdAt: '2024-12-09T12:00:00Z',
              updatedAt: '2024-12-09T12:00:00Z'
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
        props: 'An array of @type(Props:prop)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          name: 'general-chat',
          props: [
            { key: 'channelType', value: 'public' }
          ]
        }
      },
      {
        title: 'Sample response',
        sample: {
          channel: {
            id: 1,
            name: 'general-chat',
            ownerAliasId: 1,
            totalMessages: 0,
            memberCount: 1,
            props: [
              { key: 'channelType', value: 'public' }
            ],
            createdAt: '2024-12-09T12:00:00Z',
            updatedAt: '2024-12-09T12:00:00Z'
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
        title: 'Sample request',
        sample: {
          name: 'general-chat'
        }
      },
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
            createdAt: '2024-12-09T12:00:00Z',
            updatedAt: '2024-12-09T12:00:00Z'
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
            ownerAliasId: 2,
            totalMessages: 308,
            memberCount: 42,
            props: [
              { key: 'channelType', value: 'public' },
              { key: 'recentlyUpdated', value: 'true' }
            ],
            createdAt: '2024-12-09T12:00:00Z',
            updatedAt: '2024-12-09T12:01:00Z'
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
  }
}

export default GameChannelAPIDocs
