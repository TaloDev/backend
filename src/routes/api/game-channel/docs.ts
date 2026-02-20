import { RouteDocs } from '../../../lib/docs/docs-registry'

export const listDocs = {
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
            totalMessages: 308,
            memberCount: 42,
            props: [{ key: 'channelType', value: 'public' }],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z',
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
                groups: [],
              },
              lastSeenAt: '2024-12-04T07:15:13.000Z',
              createdAt: '2024-10-25T18:18:28.000Z',
              updatedAt: '2024-12-04T07:15:13.000Z',
            },
            totalMessages: 36,
            memberCount: 8,
            props: [
              { key: 'channelType', value: 'guild' },
              { key: 'guildId', value: '5912' },
            ],
            autoCleanup: true,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z',
          },
        ],
        count: 2,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with prop key filtering',
      sample: {
        url: '/v1/game-channels?propKey=guildId',
        query: {
          propKey: 'guildId',
        },
      },
    },
    {
      title: 'Sample request with prop key and value filtering',
      sample: {
        url: '/v1/game-channels?propKey=guildId&propValue=5912',
        query: {
          propKey: 'guildId',
          propValue: '5912',
        },
      },
    },
  ],
} satisfies RouteDocs

export const getDocs = {
  description: 'Find a game channel',
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
          props: [{ key: 'channelType', value: 'public' }],
          autoCleanup: false,
          private: false,
          createdAt: '2024-12-09T12:00:00.000Z',
          updatedAt: '2024-12-09T12:00:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const subscriptionsDocs = {
  description: 'List game channels that the player is subscribed to',
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
            props: [{ key: 'channelType', value: 'public' }],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z',
          },
          {
            id: 2,
            name: 'trade-chat',
            owner: null,
            totalMessages: 23439,
            memberCount: 124,
            props: [{ key: 'channelType', value: 'public' }],
            autoCleanup: false,
            private: false,
            createdAt: '2024-12-09T12:00:00.000Z',
            updatedAt: '2024-12-09T12:00:00.000Z',
          },
        ],
      },
    },
    {
      title: 'Sample request with prop key filtering',
      sample: {
        url: '/v1/game-channels/subscriptions?propKey=guildId',
        query: {
          propKey: 'guildId',
        },
      },
    },
    {
      title: 'Sample request with prop key and value filtering',
      sample: {
        url: '/v1/game-channels/subscriptions?propKey=guildId&propValue=5912',
        query: {
          propKey: 'guildId',
          propValue: '5912',
        },
      },
    },
  ],
} satisfies RouteDocs

export const postDocs = {
  description: 'Create a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: 'guild-chat',
        props: [
          { key: 'channelType', value: 'guild' },
          { key: 'guildId', value: '5912' },
        ],
        autoCleanup: true,
        private: false,
      },
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
              groups: [],
            },
            lastSeenAt: '2024-12-04T07:15:13.000Z',
            createdAt: '2024-10-25T18:18:28.000Z',
            updatedAt: '2024-12-04T07:15:13.000Z',
          },
          totalMessages: 0,
          memberCount: 1,
          props: [
            { key: 'channelType', value: 'guild' },
            { key: 'guildId', value: '5912' },
          ],
          autoCleanup: true,
          private: false,
          createdAt: '2024-12-09T12:00:00.000Z',
          updatedAt: '2024-12-09T12:00:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const joinDocs = {
  description: 'Join a game channel',
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
          props: [{ key: 'channelType', value: 'public' }],
          autoCleanup: false,
          private: false,
          createdAt: '2024-12-09T12:00:00.000Z',
          updatedAt: '2024-12-09T12:00:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const leaveDocs = {
  description: 'Leave a game channel',
} satisfies RouteDocs

export const putDocs = {
  description: 'Update a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: 'new-general-chat',
        props: [
          { key: 'channelType', value: 'public' },
          { key: 'recentlyUpdated', value: 'true' },
        ],
        ownerAliasId: 2,
      },
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
              groups: [],
            },
            lastSeenAt: '2024-12-04T07:15:13.000Z',
            createdAt: '2024-10-25T18:18:28.000Z',
            updatedAt: '2024-12-04T07:15:13.000Z',
          },
          totalMessages: 308,
          memberCount: 42,
          props: [
            { key: 'channelType', value: 'public' },
            { key: 'recentlyUpdated', value: 'true' },
          ],
          autoCleanup: false,
          private: false,
          createdAt: '2024-12-09T12:00:00.000Z',
          updatedAt: '2024-12-09T12:01:00.000Z',
        },
      },
    },
  ],
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a game channel',
} satisfies RouteDocs

export const inviteDocs = {
  description: 'Invite another player to a game channel',
} satisfies RouteDocs

export const membersDocs = {
  description: 'Get the members of a game channel',
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
              groups: [],
            },
            lastSeenAt: '2025-05-04T07:15:13.000Z',
            createdAt: '2025-04-25T18:18:28.000Z',
            updatedAt: '2025-05-04T07:15:13.000Z',
          },
        ],
        count: 1,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
  ],
} satisfies RouteDocs

export const getStorageDocs = {
  description: 'Get a single storage property from a game channel',
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
              groups: [],
            },
            lastSeenAt: '2025-09-20T07:15:13.000Z',
            createdAt: '2025-08-15T18:18:28.000Z',
            updatedAt: '2025-09-20T07:15:13.000Z',
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
              groups: [],
            },
            lastSeenAt: '2025-09-20T07:15:13.000Z',
            createdAt: '2025-08-15T18:18:28.000Z',
            updatedAt: '2025-09-20T07:15:13.000Z',
          },
          createdAt: '2025-09-15T12:00:00.000Z',
          updatedAt: '2025-09-20T12:30:00.000Z',
        },
      },
    },
    {
      title: 'Sample response when property does not exist',
      sample: {
        prop: null,
      },
    },
  ],
} satisfies RouteDocs

export const listStorageDocs = {
  description: 'Get multiple storage properties from a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        url: '/v1/game-channels/1/storage/list?propKeys=guildConfig&propKeys=memberList',
        query: {
          propKeys: ['guildConfig', 'memberList'],
        },
      },
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
                groups: [],
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z',
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
                groups: [],
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z',
            },
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T12:30:00.000Z',
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
                groups: [],
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z',
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
                groups: [],
              },
              lastSeenAt: '2025-09-18T09:30:45.000Z',
              createdAt: '2025-08-25T14:22:18.000Z',
              updatedAt: '2025-09-18T09:30:45.000Z',
            },
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T15:45:00.000Z',
          },
        ],
      },
    },
  ],
} satisfies RouteDocs

export const putStorageDocs = {
  description: 'Create or update storage properties in a game channel',
  samples: [
    {
      title: 'Sample request to create/update properties',
      sample: {
        props: [
          { key: 'guildConfig', value: '{"joinRequirement":"level15","maxMembers":75}' },
          { key: 'memberList', value: '["player1","player2","player3","player4"]' },
          { key: 'lastUpdated', value: '2025-09-20T16:30:00.000Z' },
        ],
      },
    },
    {
      title: 'Sample request to delete a property',
      sample: {
        props: [{ key: 'temporaryData', value: null }],
      },
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
              groups: [],
            },
            lastSeenAt: '2025-09-20T07:15:13.000Z',
            createdAt: '2025-08-15T18:18:28.000Z',
            updatedAt: '2025-09-20T07:15:13.000Z',
          },
          totalMessages: 156,
          memberCount: 8,
          props: [
            { key: 'channelType', value: 'guild' },
            { key: 'guildId', value: '5912' },
          ],
          autoCleanup: true,
          private: false,
          createdAt: '2025-09-15T12:00:00.000Z',
          updatedAt: '2025-09-20T16:30:00.000Z',
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
                groups: [],
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z',
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
                groups: [],
              },
              lastSeenAt: '2025-09-20T07:15:13.000Z',
              createdAt: '2025-08-15T18:18:28.000Z',
              updatedAt: '2025-09-20T07:15:13.000Z',
            },
            createdAt: '2025-09-15T12:00:00.000Z',
            updatedAt: '2025-09-20T16:30:00.000Z',
          },
        ],
        deletedProps: [],
        failedProps: [],
      },
    },
  ],
} satisfies RouteDocs
