import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import LeaderboardEntry from '../../../../src/entities/leaderboard-entry'
import Leaderboard from '../../../../src/entities/leaderboard'
import Player from '../../../../src/entities/player'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createUserAndToken from '../../../utils/createUserAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import assert from 'node:assert'

describe('Leaderboard  - reset', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(3)
    const livePlayers = await new PlayerFactory([game]).many(3)
    const allPlayers = [...devPlayers, ...livePlayers]

    const entries = await new LeaderboardEntryFactory(leaderboard, allPlayers).many(6)
    await em.persistAndFlush(entries)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRIES_RESET,
      game
    })

    if (statusCode === 200) {
      expect(res.body.deletedCount).toBe(6)

      const entries = await em.repo(LeaderboardEntry).find({ leaderboard })
      expect(entries).toHaveLength(0)

      assert(activity?.extra.display)
      expect(activity.extra.leaderboardInternalName).toBe(leaderboard.internalName)
      expect(activity.extra.display['Reset mode']).toBe('All players')
      expect(activity.extra.display['Deleted count']).toBe(6)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to reset leaderboard entries' })
      expect(activity).toBeNull()
    }
  })

  it('should reset all entries when mode is "all"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)
    const allPlayers = [...devPlayers, ...livePlayers]

    const entries = await new LeaderboardEntryFactory(leaderboard, allPlayers).many(5)
    await em.persistAndFlush(entries)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'all' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(5)

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(0)
  })

  it('should reset only dev entries when mode is "dev"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devEntries = await new LeaderboardEntryFactory(leaderboard, devPlayers).many(2)
    const liveEntries = await new LeaderboardEntryFactory(leaderboard, livePlayers).many(3)

    await em.persistAndFlush([...devEntries, ...liveEntries])

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(2)

    const remainingEntries = await em.repo(LeaderboardEntry).find({
      leaderboard
    }, {
      populate: ['playerAlias.player']
    })
    expect(remainingEntries).toHaveLength(3)
    expect(remainingEntries.every((entry) => !entry.playerAlias.player.devBuild)).toBe(true)
  })

  it('should reset only live entries when mode is "live"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devEntries = await new LeaderboardEntryFactory(leaderboard, devPlayers).many(2)
    const liveEntries = await new LeaderboardEntryFactory(leaderboard, livePlayers).many(3)

    await em.persistAndFlush([...devEntries, ...liveEntries])

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(3)

    const remainingEntries = await em.repo(LeaderboardEntry).find({
      leaderboard
    }, {
      populate: ['playerAlias.player']
    })
    expect(remainingEntries).toHaveLength(2)
    expect(remainingEntries.every((entry) => entry.playerAlias.player.devBuild)).toBe(true)
  })

  it('should return 0 deleted count when no entries match the mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, devPlayers).many(2)

    await em.persistAndFlush(entries)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(0)

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(2)
  })

  it('should create game activity with correct data', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(3)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(3)

    await em.persistAndFlush(entries)

    await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRIES_RESET,
      game,
      user
    })

    expect(activity).not.toBeNull()
    expect(activity!.extra).toEqual({
      leaderboardInternalName: leaderboard.internalName,
      display: {
        'Reset mode': 'Dev players',
        'Deleted count': expect.any(Number)
      }
    })
  })

  it('should not reset entries for a leaderboard in a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    const players = await new PlayerFactory([otherGame]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)

    await em.persistAndFlush(entries)

    const res = await request(app)
      .delete(`/games/${otherGame.id}/leaderboards/${leaderboard.id}/entries`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    const remainingEntries = await em.repo(LeaderboardEntry).find({ leaderboard })
    expect(remainingEntries).toHaveLength(2)
  })

  it('should not reset entries for a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/99999/entries`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should handle invalid reset mode gracefully', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ mode: 'invalid' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        mode: ['Mode must be one of: all, live, dev']
      }
    })
  })

  it('should reset entries and maintain referential integrity', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(2)
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(2)

    await em.persistAndFlush(entries)

    await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const existingLeaderboard = await em.repo(Leaderboard).findOne(leaderboard.id)
    expect(existingLeaderboard).not.toBeNull()

    const existingPlayers = await em.repo(Player).find({})
    expect(existingPlayers.length).toBeGreaterThanOrEqual(2)
  })
})
