import { RouteDocs } from '../../../lib/docs/docs-registry'

const sampleSave = {
  id: 143,
  name: 'Autosave 86 - Blade Merchant Shop',
  content: {
    objects: [
      {
        id: 'b9339e0a-b91b-439e-bb30-b3b6f23d8159',
        name: 'Interactables.Items.SmallKnife',
        data: [
          {
            key: 'pickedUp',
            value: 'True',
            type: 'System.Boolean'
          },
          {
            key: 'meta.destroyed',
            value: 'True',
            type: 'System.Boolean'
          }
        ]
      },
      {
        id: '9b772ede-ddd0-4dc0-aaf3-e59c9258e672',
        name: 'NPCs.BladeMerchant',
        data: [
          {
            key: 'lastWords',
            value: 'Wait...where did you find that knife?',
            type: 'System.String'
          },
          {
            key: 'isAlive',
            value: 'False',
            type: 'System.Boolean'
          },
          {
            key: 'meta.destroyed',
            value: 'False',
            type: 'System.Boolean'
          }
        ]
      }
    ]
  },
  updatedAt: '2022-06-07T14:58:13.771Z'
}

export const listDocs = {
  description: 'Get a player\'s saves',
  samples: [
    {
      title: 'Sample response',
      sample: {
        saves: [sampleSave]
      }
    }
  ]
} satisfies RouteDocs

export const postDocs = {
  description: 'Create a save',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: sampleSave.name,
        content: sampleSave.content
      }
    },
    {
      title: 'Sample response',
      sample: {
        save: sampleSave
      }
    }
  ]
} satisfies RouteDocs

export const patchDocs = {
  description: 'Update a save',
  samples: [
    {
      title: 'Sample request',
      sample: {
        name: sampleSave.name,
        content: sampleSave.content
      }
    },
    {
      title: 'Sample response',
      sample: {
        save: sampleSave
      }
    }
  ]
} satisfies RouteDocs

export const deleteDocs = {
  description: 'Delete a save'
} satisfies RouteDocs
