import { RouteDocs } from '../../../lib/docs/docs-registry'

export const listCategoriesDocs = {
  description: 'Get available feedback categories',
  samples: [
    {
      title: 'Sample response',
      sample: {
        feedbackCategories: [
          {
            id: 1,
            internalName: 'bugs',
            name: 'Bugs',
            description: 'Issues that hinder the player experience',
            createdAt: '2024-06-01T21:36:02.008Z'
          }
        ]
      }
    }
  ]
} satisfies RouteDocs

export const postDocs = {
  description: 'Create a player feedback entry',
  samples: [
    {
      title: 'Sample request',
      sample: {
        comment: 'The new quest in the new zone cannot be completed!'
      }
    },
    {
      title: 'Sample anonymised feedback response',
      sample: {
        feedback: {
          id: 36,
          category: {
            id: 1,
            internalName: 'bugs',
            name: 'Bugs',
            description: 'Issues that hinder the player experience',
            anonymised: false,
            createdAt: '2024-06-01T21:36:02.008Z'
          },
          comment: 'The new quest in the new zone cannot be completed!',
          anonymised: true,
          playerAlias: null,
          createdAt: '2024-06-03T18:04:44.336Z'
        }
      }
    },
    {
      title: 'Sample identifiable feedback response',
      sample: {
        feedback: {
          id: 36,
          category: {
            id: 1,
            internalName: 'bugs',
            name: 'Bugs',
            description: 'Issues that hinder the player experience',
            anonymised: false,
            createdAt: '2024-06-01T21:36:02.008Z'
          },
          comment: 'The new quest in the new zone cannot be completed!',
          anonymised: false,
          playerAlias: {
            id: 1,
            service: 'steam',
            identifier: '11133645',
            player: {
              id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
              props: [
                { key: 'xPos', value: '13.29' },
                { key: 'yPos', value: '26.44' }
              ],
              aliases: [
                '/* [Circular] */'
              ],
              devBuild: false,
              createdAt: '2022-01-15T13:20:32.133Z',
              lastSeenAt: '2022-04-12T15:09:43.066Z'
            }
          },
          createdAt: '2024-06-03T18:04:44.336Z'
        }
      }
    }
  ]
} satisfies RouteDocs
