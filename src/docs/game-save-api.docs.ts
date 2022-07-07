import { RouteDocs } from 'koa-clay'

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
  updatedAt: '2022-06-07 14:58:13'
}

const GameSaveAPIDocs: Record<string, RouteDocs> = {
  index: {
    description: 'Get a player\'s saves',
    params: {
      query: {
        aliasId: 'The ID of the player\'s alias'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          saves: [sampleSave]
        }
      }
    ]
  },
  post: {
    description: 'Create a save',
    params: {
      body: {
        name: 'The name of the save',
        content: 'The @type(SaveContent:savecontent) of the save file',
        aliasId: 'The ID of the player\'s alias'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          name: sampleSave.name,
          content: sampleSave.content,
          aliasId: 15
        }
      },
      {
        title: 'Sample response',
        sample: {
          save: sampleSave
        }
      }
    ]
  },
  patch: {
    description: 'Update a save',
    params: {
      body: {
        name: 'A new name for the save',
        content: 'The new @type(SaveContent:savecontent) for the save',
        aliasId: 'The ID of the player\'s alias'
      },
      route: {
        id: 'The ID of the save'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          name: sampleSave.name,
          content: sampleSave.content,
          aliasId: 15
        }
      },
      {
        title: 'Sample response',
        sample: {
          save: sampleSave
        }
      }
    ]
  }
}

export default GameSaveAPIDocs
