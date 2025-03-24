import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../src/entities/player-group-rule'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import PlayerProp from '../../../src/entities/player-prop'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'

describe('EQUALS rule', () => {
  it('should correctly evaluate an EQUALS rule', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

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

  it('should correctly evaluate a negated EQUALS rule', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state(() => ({ lastSeenAt: new Date(2022, 4, 3) })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'lastSeenAt',
        operands: ['2022-05-03'],
        negate: true,
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

  it('should correctly evaluate an EQUALS rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'props.currentLevel',
        operands: ['80'],
        negate: false,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated EQUALS rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'currentLevel', '80')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: 'props.currentLevel',
        operands: ['80'],
        negate: true,
        castType: PlayerGroupRuleCastType.CHAR
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate an EQUALS rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game]).state(() => ({ minValue: 1, maxValue: 80 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player1, stat).state(() => ({ value: 60 })).one()
    await em.persistAndFlush([player1, player2, playerStat])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: `statValue.${stat.internalName}`,
        operands: ['60'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated EQUALS rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game]).state(() => ({ minValue: 1, maxValue: 80 })).one()
    const playerStat = await new PlayerGameStatFactory().construct(player1, stat).state(() => ({ value: 60 })).one()
    await em.persistAndFlush([player1, player2, playerStat])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: `statValue.${stat.internalName}`,
        operands: ['60'],
        negate: true,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate an EQUALS rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1]).state(() => ({ score: 60 })).one()
    await em.persistAndFlush([player1, player2, leaderboardEntry])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: ['60'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should correctly evaluate a negated EQUALS rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1]).state(() => ({ score: 60 })).one()
    await em.persistAndFlush([player1, player2, leaderboardEntry])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: ['60'],
        negate: true,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(1)
  })

  it('should not add a player to a group if their leaderboard entry is hidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1]).state(() => ({ score: 60, hidden: true })).one()
    await em.persistAndFlush([player1, player2, leaderboardEntry])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.EQUALS,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: ['60'],
        negate: false,
        castType: PlayerGroupRuleCastType.DOUBLE
      }
    ]

    const res = await request(app)
      .get(`/games/${game.id}/player-groups/preview-count`)
      .query({ ruleMode: '$and', rules: encodeURI(JSON.stringify(rules)) })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toEqual(0)
  })
})
