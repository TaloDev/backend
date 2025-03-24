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

describe('SET rule', () => {
  it('should correctly evaluate a SET rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasFinishedGame', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasFinishedGame',
        operands: [],
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

  it('should correctly evaluate a negated SET rule with props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'hasFinishedGame', '1')
      ])
    })).one()
    const player2 = await new PlayerFactory([game]).one()
    await em.persistAndFlush([player1, player2])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: 'props.hasFinishedGame',
        operands: [],
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

  it('should correctly evaluate a SET rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player1, stat).one()
    await em.persistAndFlush([player1, player2, playerStat])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: `statValue.${stat.internalName}`,
        operands: [],
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

  it('should correctly evaluate a negated SET rule with stat values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const stat = await new GameStatFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player1, stat).one()
    await em.persistAndFlush([player1, player2, playerStat])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: `statValue.${stat.internalName}`,
        operands: [],
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

  it('should correctly evaluate a SET rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1]).one()
    await em.persistAndFlush([player1, player2, leaderboardEntry])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: [],
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

  it('should correctly evaluate a negated SET rule with leaderboard entry scores', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player1 = await new PlayerFactory([game]).one()
    const player2 = await new PlayerFactory([game]).one()

    const leaderboard = await new LeaderboardFactory([game]).one()
    const leaderboardEntry = await new LeaderboardEntryFactory(leaderboard, [player1]).one()
    await em.persistAndFlush([player1, player2, leaderboardEntry])

    const rules: Partial<PlayerGroupRule>[] = [
      {
        name: PlayerGroupRuleName.SET,
        field: `leaderboardEntryScore.${leaderboard.internalName}`,
        operands: [],
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
})
