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

describe('LTE rule', () => {
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

  it('should correctly evaluate a LTE rule', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    const player2 = await new PlayerFactory([game]).with(() => ({ lastSeenAt: new Date(2022, 1, 3) })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LTE,
        field: 'lastSeenAt',
        operands: ['2022-04-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated LTE rule', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    const player2 = await new PlayerFactory([game]).with(() => ({ lastSeenAt: new Date(2022, 6, 3) })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LTE,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: true,
        castType: PlayerGroupRuleCastType.DATETIME
      }
    ]

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a LTE rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '70')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LTE,
        field: 'props.currentLevel',
        operands: ['70'],
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

  it('should correctly evaluate a negated LTE rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player1 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '69')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LTE,
        field: 'props.currentLevel',
        operands: ['70'],
        negate: true,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })
})
