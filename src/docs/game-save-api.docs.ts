import GameSaveAPIService from '../services/api/game-save-api.service'
import APIDocs from './api-docs'

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

const GameSaveAPIDocs: APIDocs<GameSaveAPIService> = {
  index: {
    description: 'Get a player\'s saves',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player'
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
      headers: {
        'x-talo-player': 'The ID of the player'
      },
      body: {
        name: 'The name of the save',
        content: 'The @type(SaveContent:savecontent) of the save file'
      }
    },
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
  },
  patch: {
    description: 'Update a save',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player'
      },
      body: {
        name: 'A new name for the save',
        content: 'The new @type(SaveContent:savecontent) for the save'
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
  },
  delete: {
    description: 'Delete a save',
    params: {
      headers: {
        'x-talo-player': 'The ID of the player'
      },
      route: {
        id: 'The ID of the save'
      }
    }
  }
}

export default GameSaveAPIDocs
