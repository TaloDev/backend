import { RouteDocs } from 'koa-clay'

const PlayerAPIDocs: Record<string, RouteDocs> = {
  identify: {
    description: 'Identify a player',
    params: {
      query: {
        service: 'The name of the service where the identity of the player comes from (e.g. "steam", "epic" or "username")',
        identifier: 'The unique identifier of the player. This can be their username, an email or a numeric ID'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          alias: {
            id: 1,
            service: 'steam',
            identifier: '11133645',
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
              createdAt: '2022-01-15 13:20:32',
              lastSeenAt: '2022-04-12 15:09:43',
              groups: [
                { id: 1, name: 'Winners' }
              ]
            }
          }
        }
      }
    ]
  },
  patch: {
    description: 'Update a player\'s props',
    params: {
      body: {
        props: 'An array of @type(Props:prop). Props that the player doesn\'t have will be added. Props with updated values will overwrite existing props. Props with a null value will be deleted from the player'
      },
      route: {
        aliasId: 'The ID of the player\'s alias'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          props: [
            { key: 'currentLevel', value: '72' },
            { key: 'alive', value: null },
            { key: 'zoneId', value: '4' }
          ]
        }
      },
      {
        title: 'Sample response',
        sample: {
          player: {
            id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
            props: [
              { key: 'currentLevel', value: '72' },
              { key: 'zoneId', value: '4' }
            ],
            aliases: [
              '/* [Circular] */'
            ],
            devBuild: false,
            createdAt: '2022-01-15 13:20:32',
            lastSeenAt: '2022-04-12 15:09:43',
            groups: [
              { id: 1, name: 'Winners' }
            ]
          }
        }
      }
    ]
  },
  merge: {
    description: 'Merge two players',
    params: {
      body: {
        alias1: 'The first alias ID - the second player will be merged into this player',
        alias2: 'The second alias ID'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          alias1: 2,
          alias2: 8
        }
      },
      {
        title: 'Sample response',
        sample: {
          player: {
            id: '7a4e70ec-6ee6-418e-923d-b3a45051b7f9',
            props: [
              { key: 'currentLevel', value: '58' },
              { key: 'xPos', value: '13.29' },
              { key: 'yPos', value: '26.44' },
              { key: 'zoneId', value: '3' }
            ],
            aliases: [
              { id: 1, service: 'username', identifier: 'tud0r', player: '/* [Circular] */' },
              { id: 2, service: 'steam', identifier: '11133645', player: '/* [Circular] */' },
              { id: 8, service: 'epic', identifier: '55534821', player: '/* [Circular] */' }
            ],
            devBuild: false,
            createdAt: '2022-01-15 13:20:32',
            lastSeenAt: '2022-04-12 15:09:43',
            groups: [
              { id: 1, name: 'Winners' }
            ]
          }
        }
      }
    ]
  }
}

export default PlayerAPIDocs
