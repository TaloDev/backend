import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import PlayerProp from '../../../src/entities/player-prop'
import clearEntities from '../../utils/clearEntities'

describe('PlayerGroupRule mode', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
    await clearEntities(app.context.em, ['PlayerGroup'])
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['Player'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should correctly evaluate conditions when the rule mode is $and', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80'),
        new PlayerProp(player, 'timePlayed', '23423')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'props.currentLevel',
        operands: ['80'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      },
      {
        name: PlayerGroupRuleName.GT,
        field: 'props.timePlayed',
        operands: ['3000'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate conditions when the rule mode is $or', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80'),
        new PlayerProp(player, 'timePlayed', '546565')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '29'),
        new PlayerProp(player, 'timePlayed', '23423')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'props.currentLevel',
        operands: ['80'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      },
      {
        name: PlayerGroupRuleName.GT,
        field: 'props.timePlayed',
        operands: ['3000'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$or', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(2)
  })
})
