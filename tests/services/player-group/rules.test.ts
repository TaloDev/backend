import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../../src/entities/player-group-rule'
import PlayerFactory from '../../fixtures/PlayerFactory'

describe('Player group service - rules', () => {
  it('should return a list of available rules and player fields', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(global.app)
      .get(`/games/${game.id}/player-groups/rules`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.availableRules).toStrictEqual([
      {
        name: 'EQUALS',
        castTypes: [
          'CHAR',
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: false
      },
      {
        name: 'EQUALS',
        castTypes: [
          'CHAR',
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: true
      },
      {
        name: 'GT',
        negatable: false,
        castTypes: [
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: false
      },
      {
        name: 'GTE',
        negatable: false,
        castTypes: [
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: false
      },
      {
        name: 'LT',
        negatable: false,
        castTypes: [
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: false
      },
      {
        name: 'LTE',
        negatable: false,
        castTypes: [
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 1,
        negate: false
      },
      {
        name: 'SET',
        castTypes: [
          'CHAR',
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 0,
        negate: false
      },
      {
        name: 'SET',
        castTypes: [
          'CHAR',
          'DOUBLE',
          'DATETIME'
        ],
        operandCount: 0,
        negate: true
      }
    ])

    expect(res.body.availableFields).toStrictEqual([
      {
        fieldDisplayName: 'prop with key',
        defaultCastType: 'CHAR',
        mapsTo: 'props',
        namespaced: true
      },
      {
        fieldDisplayName: 'latest login',
        defaultCastType: 'DATETIME',
        mapsTo: 'lastSeenAt',
        namespaced: false
      },
      {
        fieldDisplayName: 'first login',
        defaultCastType: 'DATETIME',
        mapsTo: 'createdAt',
        namespaced: false
      },
      {
        fieldDisplayName: 'value for stat',
        defaultCastType: 'DOUBLE',
        mapsTo: 'statValue',
        namespaced: true
      },
      {
        fieldDisplayName: 'score in leaderboard',
        defaultCastType: 'DOUBLE',
        mapsTo: 'leaderboardEntryScore',
        namespaced: true
      }
    ])
  })
})
