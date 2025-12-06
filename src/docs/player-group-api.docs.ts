import PlayerGroupAPIService from '../services/api/player-group-api.service'
import APIDocs from './api-docs'
import { APIKeyScope } from '../entities/api-key'

const PlayerGroupAPIDocs: APIDocs<PlayerGroupAPIService> = {
  get: {
    description: 'Get a group and its members',
    scopes: [APIKeyScope.READ_PLAYER_GROUPS],
    params: {
      route: {
        id: 'The ID of the group'
      },
      query: {
        membersPage: 'The current pagination index for group members (starting at 0)'
      }
    },
    samples: [
      {
        title: 'Sample response (members visible)',
        sample: {
          group: {
            id: '74b6a013-6c3d-4de6-8f61-444b4cf6e909',
            name: 'Online players',
            description: 'Players that are currently online',
            rules: [
              {
                name: 'EQUALS',
                negate: false,
                field: 'props.online',
                castType: 'CHAR',
                operands: [
                  'true'
                ]
              }
            ],
            ruleMode: '$and',
            membersVisible: true,
            updatedAt: '2024-10-01T23:09:18.000Z',
            count: 1,
            members: [
              {
                id: '714b38f5-1dee-4243-a54c-50fb1cfe2e4e',
                props: [
                  {
                    key: 'online',
                    value: 'true'
                  }
                ],
                aliases: [],
                devBuild: false,
                createdAt: '2024-09-29T14:14:34.000Z',
                lastSeenAt: '2024-10-03T08:03:16.000Z',
                groups: [
                  {
                    id: '74b6a013-6c3d-4de6-8f61-444b4cf6e909',
                    name: 'Online players'
                  }
                ]
              }
            ]
          },
          membersPagination: {
            count: 1,
            itemsPerPage: 50,
            isLastPage: true
          }
        }
      },
      {
        title: 'Sample response (members not visible)',
        sample: {
          group: {
            id: '74b6a013-6c3d-4de6-8f61-444b4cf6e909',
            name: 'Online players',
            description: 'Players that are currently online',
            rules: [
              {
                name: 'EQUALS',
                negate: false,
                field: 'props.online',
                castType: 'CHAR',
                operands: [
                  'true'
                ]
              }
            ],
            ruleMode: '$and',
            membersVisible: false,
            updatedAt: '2024-10-01T23:09:18.000Z',
            count: 1
          },
          membersPagination: {
            count: 0,
            itemsPerPage: 50,
            isLastPage: true
          }
        }
      }
    ]
  }
}

export { PlayerGroupAPIDocs }
