import { RouteDocs } from '../../../lib/docs/docs-registry.js'

const channelSample = {
  id: 1,
  name: 'general-chat',
  owner: null,
  totalMessages: 308,
  memberCount: 42,
  props: [{ key: 'channelType', value: 'public' }],
  autoCleanup: false,
  private: false,
  temporaryMembership: false,
  createdAt: '2026-08-15T12:45:39.409Z',
  updatedAt: '2026-08-15T12:49:14.315Z',
}

const aliasSample = {
  id: 105,
  service: 'username',
  identifier: 'guild_admin',
  displayName: 'guild_admin',
  lastSeenAt: '2026-08-15T15:09:43.066Z',
  createdAt: '2026-08-01T13:20:32.133Z',
  updatedAt: '2026-08-01T13:20:32.133Z',
}

export const listDocs = {
  description: 'List game channels',
  samples: [
    {
      title: 'Sample response',
      sample: {
        channels: [
          channelSample,
          {
            ...channelSample,
            id: 2,
            name: 'guild-chat',
            totalMessages: 36,
            memberCount: 8,
            props: [
              { key: 'channelType', value: 'guild' },
              { key: 'guildId', value: '5912' },
            ],
            autoCleanup: true,
          },
        ],
        count: 2,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with filters',
      sample: {
        url: '/admin/v1/game-channels?search=guild&propKey=guildId&propValue=5912',
        query: {
          search: 'guild',
          propKey: 'guildId',
          propValue: '5912',
        },
      },
    },
  ],
} satisfies RouteDocs

export const createDocs = {
  description: 'Create a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: 'guild-chat',
        ownerAliasId: 105,
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
          ...channelSample,
          owner: aliasSample,
        },
      },
    },
  ],
} satisfies RouteDocs

export const updateDocs = {
  description: 'Update a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: 'new-general-chat',
        ownerAliasId: 2,
        props: [{ key: 'channelType', value: 'public' }],
      },
    },
    {
      title: 'Sample response',
      sample: {
        channel: {
          ...channelSample,
          name: 'new-general-chat',
        },
        rejectedProps: [
          {
            key: 'messageOfTheDay',
            error: 'PROP_CONTAINS_PROFANITY',
            message: 'Prop value contains profanity',
          },
        ],
      },
    },
  ],
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a game channel',
  samples: [
    {
      title: 'Sample request',
      sample: {
        url: '/admin/v1/game-channels/1',
      },
    },
    {
      title: 'Sample response',
      sample: {
        status: 204,
      },
    },
  ],
} satisfies RouteDocs

export const storageDocs = {
  description: "List a game channel's storage properties",
  samples: [
    {
      title: 'Sample response',
      sample: {
        channelName: 'guild-chat',
        storageProps: [
          {
            key: 'guildConfig',
            value: '{"joinRequirement":"level10","maxMembers":50}',
            createdBy: aliasSample,
            lastUpdatedBy: aliasSample,
            createdAt: '2026-08-02T14:01:18.727Z',
            updatedAt: '2026-08-02T14:01:18.727Z',
          },
        ],
        count: 1,
        itemsPerPage: 50,
        isLastPage: true,
      },
    },
    {
      title: 'Sample request with search',
      sample: {
        url: '/admin/v1/game-channels/1/storage?search=guild',
        query: {
          search: 'guild',
        },
      },
    },
  ],
} satisfies RouteDocs
