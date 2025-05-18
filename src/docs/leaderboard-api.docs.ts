import LeaderboardAPIService from '../services/api/leaderboard-api.service'
import APIDocs from './api-docs'

const LeaderboardAPIDocs: APIDocs<LeaderboardAPIService> = {
  get: {
    description: 'Get a leaderboard\'s entries\n50 results are returned per page, in the sort order defined by the leaderboard',
    params: {
      headers: {
        'x-talo-alias': 'The ID of the player\'s alias'
      },
      route: {
        internalName: 'The internal name of the leaderboard'
      },
      query: {
        page: 'The current pagination index (starting at 0)',
        aliasId: 'Only return entries for this alias ID',
        propKey: 'Only return entries with this prop key',
        propValue: 'Only return entries with a matching prop key and value'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          entries: [
            {
              id: 4,
              position: 0,
              score: 593.21,
              leaderboardName: 'Highscore',
              leaderboardInternalName: 'highscore',
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
              hidden: false,
              createdAt: '2022-01-15T14:01:18.727Z',
              updatedAt: '2022-01-15T14:01:18.727Z'
            },
            {
              id: 29,
              position: 1,
              score: 400.06,
              leaderboardName: 'Highscore',
              leaderboardInternalName: 'highscore',
              playerAlias: {
                id: 1,
                service: 'epic',
                identifier: '44661821',
                player: {
                  id: '1c4d8680-8865-4bfa-8212-f9a405e77897',
                  props: [
                    { key: 'xPos', value: '117.33' },
                    { key: 'yPos', value: '-50.80' }
                  ],
                  aliases: [
                    '/* [Circular] */'
                  ],
                  devBuild: false,
                  createdAt: '2022-06-15T14:13:16.133Z',
                  lastSeenAt: '2022-06-15T15:01:55.066Z'
                }
              },
              hidden: false,
              createdAt: '2022-06-15T14:48:11.727Z',
              updatedAt: '2022-06-15T14:48:11.727Z'
            },
            '/* ...48 more entries */'
          ],
          count: 126,
          isLastPage: false
        }
      },
      {
        title: 'Sample request with prop key filtering',
        sample: {
          url: '/v1/leaderboards/highscore?propKey=team',
          query: {
            propKey: 'team'
          }
        }
      },
      {
        title: 'Sample request with prop key and value filtering',
        sample: {
          url: '/v1/leaderboards/highscore?propKey=team&propValue=red',
          query: {
            propKey: 'team',
            propValue: 'red'
          }
        }
      }
    ]
  },
  post: {
    description: 'Create or update a leaderboard\'s entry\nIf an entry exists for the player and the leaderboard mode is set to unique, that entry will be updated with the new score (and the updated key will return true)',
    params: {
      body: {
        score: 'A numeric score for the entry'
      },
      route: {
        internalName: 'The internal name of the leaderboard'
      }
    },
    samples: [
      {
        title: 'Sample response',
        sample: {
          entry: {
            id: 4,
            position: 0,
            score: 593.21,
            leaderboardName: 'Highscore',
            leaderboardInternalName: 'highscore',
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
            hidden: false,
            createdAt: '2022-01-15T14:01:18.727Z',
            updatedAt: '2022-02-16T16:03:53.123Z'
          },
          updated: true
        }
      }
    ]
  }
}

export default LeaderboardAPIDocs
