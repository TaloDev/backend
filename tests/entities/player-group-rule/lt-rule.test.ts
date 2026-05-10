import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerGroupRule, {
  PlayerGroupRuleCastType,
  PlayerGroupRuleName,
} from '../../../src/entities/player-group-rule.js'
import PlayerProp from '../../../src/entities/player-prop.js'
import GameStatFactory from '../../fixtures/GameStatFactory.js'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory.js'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('LT rule', () => {
  it('should correctly evaluate a LT rule', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game])
      .state(() => ({ lastSeenAt: new Date(2022, 4, 3) }))
      .one()
    const player2 = await new PlayerFactory([game])
      .state(() => ({ lastSeenAt: new Date(2022, 1, 3) }))
      .one()
    await em.persist([player1, player2]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: 'lastSeenAt',
        operands: ['2022-04-03'],
        negate: false,
        castType: PlayerGroupRuleCastType.DATETIME,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated LT rule', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game])
      .state(() => ({ lastSeenAt: new Date(2022, 4, 3) }))
      .one()
    const player2 = await new PlayerFactory([game])
      .state(() => ({ lastSeenAt: new Date(2022, 1, 3) }))
      .one()
    await em.persist([player1, player2]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: 'lastSeenAt',
        operands: ['2022-04-03'],
        negate: true,
        castType: PlayerGroupRuleCastType.DATETIME,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a LT rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'currentLevel', '80')]),
      }))
      .one()
    const player2 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'currentLevel', '69')]),
      }))
      .one()
    await em.persist([player1, player2]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: 'props.currentLevel',
        operands: ['70'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated LT rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'currentLevel', '80')]),
      }))
      .one()
    const player2 = await new PlayerFactory([game])
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [new PlayerProp(player, 'currentLevel', '70')]),
      }))
      .one()
    await em.persist([player1, player2]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: 'props.currentLevel',
        operands: ['71'],
        negate: true,
        castType: PlayerGroupRuleCastType.CHAR,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a LT rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game])
      .state(() => ({ minValue: 1, maxValue: 80 }))
      .one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 60 }))
      .one()
    await em.persist([player1, player2, playerStat]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: `statValue.${stat.internalName}`,
        operands: ['61'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated LT rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game])
      .state(() => ({ minValue: 1, maxValue: 80 }))
      .one()
    const playerStat = await new PlayerGameStatFactory()
      .construct(player1, stat)
      .state(() => ({ value: 60 }))
      .one()
    await em.persist([player1, player2, playerStat]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: `statValue.${stat.internalName}`,
        operands: ['61'],
        negate: true,
        castType: PlayerGroupRuleCastType.DOUBLE,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a LT rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1])
      .state(() => ({ score: 60 }))
      .one()
    await em.persist([player1, player2, leaderboardEntry]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: ['61'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated LT rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1])
      .state(() => ({ score: 60 }))
      .one()
    await em.persist([player1, player2, leaderboardEntry]).flush()

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.LT,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: ['61'],
        negate: true,
        castType: PlayerGroupRuleCastType.DOUBLE,
      },
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })
})
