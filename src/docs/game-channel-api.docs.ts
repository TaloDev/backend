import GameChannelAPIService from '../services/api/game-channel-api.service'
import APIDocs from './api-docs'
import { APIKeyScope } from '../entities/api-key'

const GameChannelAPIDocs: APIDocs<GameChannelAPIService> = {
  index: {
    description: 'List game channels',
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
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
      },
      {
        title: 'Sample request with prop key filtering',
        sample: {
          url: '/v1/game-channels?propKey=guildId',
          query: {
            propKey: 'guildId'
          }
        }
      },
      {
        title: 'Sample request with prop key and value filtering',
        sample: {
          url: '/v1/game-channels?propKey=guildId&propValue=5912',
          query: {
            propKey: 'guildId',
            propValue: '5912'
          }
        }
      }
    ]
  },
  get: {
    description: 'Find a game channel',
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
    params: {
      route: {
        id: 'The ID of the channel'
      },
      query: {
        propKey: 'Only return channels with this prop key',
        propValue: 'Only return channels with a matching prop key and value'
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
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      query: {
        propKey: 'Only return channels with this prop key',
        propValue: 'Only return channels with a matching prop key and value'
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
      },
      {
        title: 'Sample request with prop key filtering',
        sample: {
          url: '/v1/game-channels/subscriptions?propKey=guildId',
          query: {
            propKey: 'guildId'
          }
        }
      },
      {
        title: 'Sample request with prop key and value filtering',
        sample: {
          url: '/v1/game-channels/subscriptions?propKey=guildId&propValue=5912',
          query: {
            propKey: 'guildId',
            propValue: '5912'
          }
        }
      }
    ]
  },
  post: {
    description: 'Create a game channel',
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
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
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
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
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
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
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      body: {
        name: 'The new name of the channel',
        props: 'An array of @type(Props:prop)',
        ownerAliasId: 'The ID of the new owner of the channel',
        autoCleanup: 'Whether the channel should be automatically deleted when the owner leaves or the channel is empty (default is false)',
        private: 'Private channels require invites to join them (default is false)'
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
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
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
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
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
  },
  members: {
    description: 'Get the members of a game channel',
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      },
      query: {
        page: 'The current pagination index (starting at 0)',
        playerId: 'Filter members by this player ID',
        aliasId: 'Find a member with this player alias ID',
        identifier: 'Find a member with this identifier',
        playerPropKey: 'Filter members by players with this prop key',
        playerPropValue: 'Filter members by players with matching prop keys and values',
        playerGroupId: 'Filter members by players in this group'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          members: [
            {
              id: 105,
              service: 'username',
              identifier: 'player_one',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-04-25T18:18:28.000Z',
                lastSeenAt: '2025-05-04T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2025-05-04T07:15:13.000Z',
              createdAt: '2025-04-25T18:18:28.000Z',
              updatedAt: '2025-05-04T07:15:13.000Z'
            }
          ],
          count: 1,
          itemsPerPage: 50,
          isLastPage: true
        }
      }
    ]
  },
  getStorage: {
    description: 'Get a single storage property from a game channel',
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      },
      query: {
        propKey: 'The key of the storage property to retrieve'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          prop: {
            key: 'guildConfig',
            value: '{"joinRequirement":"level10","maxMembers":50}',
            createdBy: {
              id: 105,
              service: 'username',
              identifier: 'guild_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-08-15T18:18:28.000Z',
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z'
            },
            lastUpdatedBy: {
              id: 105,
              service: 'username',
              identifier: 'guild_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-08-15T18:18:28.000Z',
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z'
            },
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T12:30:00.000Z'
          }
        }
      },
      {
        title: 'Sample response when property does not exist',
        sample: {
          prop: null
        }
      }
    ]
  },
  listStorage: {
    description: 'Get multiple storage properties from a game channel',
    scopes: [APIKeyScope.READ_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      },
      query: {
        propKeys: 'An array of storage property keys to retrieve (maximum 50 keys)'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          url: '/v1/game-channels/1/storage/list?propKeys=guildConfig&propKeys=memberList',
          query: {
            propKeys: ['guildConfig', 'memberList']
          }
        }
      },
      {
        title: 'Sample response',
        sample: {
          props: [
            {
              key: 'guildConfig',
              value: '{"joinRequirement":"level10","maxMembers":50}',
              createdBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              lastUpdatedBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              createdAt: '2025-09-15T12:00:00.000Z',
              updatedAt: '2025-09-20T12:30:00.000Z'
            },
            {
              key: 'memberList',
              value: '["player1","player2","player3"]',
              createdBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              lastUpdatedBy: {
                id: 107,
                service: 'username',
                identifier: 'member_manager',
                player: {
                  id: '96e78695-2457-5fbe-b28f-fe8ce7d96f75',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-25T14:22:18.000Z',
                  lastSeenAt: '2025-09-18T09:30:45.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-18T09:30:45.000Z',
                createdAt: '2025-08-25T14:22:18.000Z',
                updatedAt: '2025-09-18T09:30:45.000Z'
              },
              createdAt: '2025-09-15T12:00:00.000Z',
              updatedAt: '2025-09-20T15:45:00.000Z'
            }
          ]
        }
      }
    ]
  },
  putStorage: {
    description: 'Create or update storage properties in a game channel',
    scopes: [APIKeyScope.WRITE_GAME_CHANNELS],
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the channel'
      },
      body: {
        props: 'An array of storage properties to create or update. Set value to null to delete a property.'
      }
    },
    samples: [
      {
        title: 'Sample request to create/update properties',
        sample: {
          props: [
            { key: 'guildConfig', value: '{"joinRequirement":"level15","maxMembers":75}' },
            { key: 'memberList', value: '["player1","player2","player3","player4"]' },
            { key: 'lastUpdated', value: '2025-09-20T16:30:00.000Z' }
          ]
        }
      },
      {
        title: 'Sample request to delete a property',
        sample: {
          props: [
            { key: 'temporaryData', value: null }
          ]
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
              identifier: 'guild_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-08-15T18:18:28.000Z',
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z'
            },
            totalMessages: 156,
            memberCount: 8,
            props: [
              { key: 'channelType', value: 'guild' },
              { key: 'guildId', value: '5912' }
            ],
            autoCleanup: true,
            private: false,
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T16:30:00.000Z'
          },
          upsertedProps: [
            {
              key: 'guildConfig',
              value: '{"joinRequirement":"level15","maxMembers":75}',
              createdBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              lastUpdatedBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              createdAt: '2025-09-15T12:00:00.000Z',
              updatedAt: '2025-09-20T16:30:00.000Z'
            },
            {
              key: 'memberList',
              value: '["player1","player2","player3","player4"]',
              createdBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              lastUpdatedBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              createdAt: '2025-09-20T15:45:00.000Z',
              updatedAt: '2025-09-20T16:30:00.000Z'
            }
          ],
          deletedProps: [],
          failedProps: []
        }
      },
      {
        title: 'Sample response with deletion',
        sample: {
          channel: {
            id: 1,
            name: 'guild-chat',
            owner: {
              id: 105,
              service: 'username',
              identifier: 'guild_admin',
              player: {
                id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                props: [],
                devBuild: false,
                createdAt: '2025-08-15T18:18:28.000Z',
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                groups: []
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z'
            },
            totalMessages: 156,
            memberCount: 8,
            props: [
              { key: 'channelType', value: 'guild' },
              { key: 'guildId', value: '5912' }
            ],
            autoCleanup: true,
            private: false,
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T16:30:00.000Z'
          },
          upsertedProps: [],
          deletedProps: [
            {
              key: 'temporaryData',
              value: 'some-old-value',
              createdBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              lastUpdatedBy: {
                id: 105,
                service: 'username',
                identifier: 'guild_admin',
                player: {
                  id: '85d67584-1346-4fad-a17f-fd7bd6c85364',
                  props: [],
                  devBuild: false,
                  createdAt: '2025-08-15T18:18:28.000Z',
                  lastSeenAt: '2025-09-20T07:15:13.000Z',
                  groups: []
                },
                lastSeenAt: '2025-09-20T07:15:13.000Z',
                createdAt: '2025-08-15T18:18:28.000Z',
                updatedAt: '2025-09-20T07:15:13.000Z'
              },
              createdAt: '2025-09-15T12:00:00.000Z',
              updatedAt: '2025-09-20T16:30:00.000Z'
            }
          ],
          failedProps: []
        }
      }
    ]
  }
}

export { GameChannelAPIDocs }
