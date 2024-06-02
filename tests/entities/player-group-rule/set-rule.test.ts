import { Collection, EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import PlayerProp from '../../../src/entities/player-prop.js'

describe('SET rule', () => {
  it('should correctly evaluate a SET rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasFinishedGame', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasFinishedGame',
        operands: [],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(global.app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated SET rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasFinishedGame', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasFinishedGame',
        operands: [],
        negate: true,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(global.app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })
})
