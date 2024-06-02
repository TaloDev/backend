import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../../src/entities/player-group-rule.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'

describe('Player group service - preview count', () => {
  it('should return a preview for the number of players in a group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).with(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
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
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should not return a preview for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const rules: Partial<PlayerGroupRule>[] = []

    const res = await request(global.app)
      .get('/games/99999/player-groups/preview-count')
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return a preview for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const rules: Partial<PlayerGroupRule>[] = []

    await request(global.app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
