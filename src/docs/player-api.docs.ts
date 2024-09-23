import PlayerAPIService from '../services/api/player-api.service'
import APIDocs from './api-docs'

const PlayerAPIDocs: APIDocs<PlayerAPIService> = {
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
            service: 'username',
            identifier: 'jimbo',
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
          }
        }
      },
      {
        title: 'Steam authentication with identity (identifier format is <identity>:<ticket>)',
        sample: {
          service: 'steam',
          identifier: 'talo:14000000bc9f006804c54b4032b27d0502002002cbfdcf771800000002000000060000004f0957cde6f88aecb090245624000000d8000000480000000500000033b19c0602002002fab015006438f58d8001b9d0000000008c57ef77fce61b780200551002000200f1cf060000000000d4dff043aed3c37739e65db7bc83d0196ecabeed867436df9cafa957ba08e29fe20739e47a3142ef1181e1fae857105545049f2bb6a6e86594fbf675246b5618b297d6535b605160f51650e61f516f05ed62163f5a0616c56c4fcbed3c049d7eedd65e69f23b843d8f92939b6987f9fc6980107079710'
        }
      },
      {
        title: 'Steam authentication without identity',
        sample: {
          service: 'steam',
          identifier: '14000000bc9f006804c54b4032b27d0502002002cbfdcf771800000002000000060000004f0957cde6f88aecb090245624000000d8000000480000000500000033b19c0602002002fab015006438f58d8001b9d0000000008c57ef77fce61b780200551002000200f1cf060000000000d4dff043aed3c37739e65db7bc83d0196ecabeed867436df9cafa957ba08e29fe20739e47a3142ef1181e1fae857105545049f2bb6a6e86594fbf675246b5618b297d6535b605160f51650e61f516f05ed62163f5a0616c56c4fcbed3c049d7eedd65e69f23b843d8f92939b6987f9fc6980107079710'
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
        id: 'The ID of the player'
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
            createdAt: '2022-01-15T13:20:32.133Z',
            lastSeenAt: '2022-04-12T15:09:43.066Z',
            groups: [
              { id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }
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
        playerId1: 'The first player ID - the second player will be merged into this player',
        playerId2: 'The second player ID'
      }
    },
    samples: [
      {
        title: 'Sample request',
        sample: {
          playerId1: '9dd68e65-a583-493e-9b5e-b11db5da8860',
          playerId2: 'c71bbc7c-cda8-4d0f-a869-ad608c73d43b'
        }
      },
      {
        title: 'Sample response',
        sample: {
          player: {
            id: '9dd68e65-a583-493e-9b5e-b11db5da8860',
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
            createdAt: '2022-01-15T13:20:32.133Z',
            lastSeenAt: '2022-04-12T15:09:43.066Z',
            groups: [
              { id: '5826ca71-1964-4a1b-abcb-a61ffbe003be', name: 'Winners' }
            ]
          }
        }
      }
    ]
  }
}

export default PlayerAPIDocs
