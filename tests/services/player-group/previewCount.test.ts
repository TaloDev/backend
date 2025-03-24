import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerGroupRule, { PlayerGroupRuleName, PlayerGroupRuleCastType } from '../../../src/entities/player-group-rule'
import PlayerFactory from '../../fixtures/PlayerFactory'

describe('Player group service - preview count', () => {
  it('should return a preview for the number of players in a group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    await em.persistAndFlush(player)

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should not return dev build players in the group members without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    await em.persistAndFlush(player)

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(0)
  })

  it('should return dev build players in the group members with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    await em.persistAndFlush(player)

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should not return a preview for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const rules: Partial<PlayerGroupRule>[] = []

    const res = await request(app)
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

    await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
