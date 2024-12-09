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
              owner: null,
              props: [
                { key: 'channelType', value: 'public' }
              ],
              createdAt: '2024-12-09T12:00:00Z',
              updatedAt: '2024-12-09T12:00:00Z'
            },
            {
              id: 2,
              name: 'guild-chat',
              owner: {
                id: 1,
                service: 'username',
                identifier: 'guild_admin_bob',
                player: {
                  id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                  props: [
                    { key: 'currentLevel', value: '58' },
                    { key: 'xPos', value: '13.29' },
                    { key: 'yPos', value: '26.44' },
                    { key: 'zoneId', value: '3' }
                  ],
                  aliases: [
                    '/* [Circular] */'
                  ],
                  devBuild: false,
                  createdAt: '2022-01-15T13:20:32.133Z',
                  lastSeenAt: '2022-04-12T15:09:43.066Z',
                  groups: [
                    { id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }
                  ]
                }
              },
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
            owner: {
              id: 1,
              service: 'username',
              identifier: 'guild_admin_bob',
              player: {
                id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                props: [
                  { key: 'currentLevel', value: '58' },
                  { key: 'xPos', value: '13.29' },
                  { key: 'yPos', value: '26.44' },
                  { key: 'zoneId', value: '3' }
                ],
                aliases: [
                  '/* [Circular] */'
                ],
                devBuild: false,
                createdAt: '2022-01-15T13:20:32.133Z',
                lastSeenAt: '2022-04-12T15:09:43.066Z',
                groups: [
                  { id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }
                ]
              }
            },
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
            owner: {
              id: 2,
              service: 'username',
              identifier: 'new_admin_john',
              player: {
                id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
                props: [],
                aliases: [
                  '/* [Circular] */'
                ],
                devBuild: false,
                createdAt: '2022-01-15T13:20:32.133Z',
                lastSeenAt: '2022-04-12T15:09:43.066Z',
                groups: [
                  { id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }
                ]
              }
            },
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
