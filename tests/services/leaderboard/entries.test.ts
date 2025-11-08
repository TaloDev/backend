import request from 'supertest'
import { subDays, addDays, format } from 'date-fns'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import LeaderboardEntry from '../../../src/entities/leaderboard-entry'
import LeaderboardEntryProp from '../../../src/entities/leaderboard-entry-prop'
import { Collection } from '@mikro-orm/mysql'
import { LeaderboardSortMode } from '../../../src/entities/leaderboard'

describe('Leaderboard service - entries', () => {
  it('should return a leaderboard\'s entries', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(10)
    em.persist(players)

    const leaderboard = await new LeaderboardFactory([game]).withEntries().one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
    expect(res.body.entries.every((entry: LeaderboardEntry) => entry.deletedAt === null)).toBe(true)
  })

  it('should not return entries for a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/21312312/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should not return a leaderboard\'s entries for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const leaderboard = await new LeaderboardFactory([game]).withEntries().one()
    await em.persistAndFlush(leaderboard)

    await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should correctly mark the last page', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(10)
    em.persist(players)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, game.players.getItems()).many(106)
    await em.persistAndFlush([leaderboard, ...entries])

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
        .query({ page: i })
        .auth(token, { type: 'bearer' })
        .expect(200)

      expect(res.body.entries).toHaveLength(i === 2 ? 6 : 50)
      expect(res.body.count).toBe(106)
      expect(res.body.itemsPerPage).toBe(50)
      expect(res.body.isLastPage).toBe(i === 2 ? true : false)
    }
  })

  it('should not return leaderboard entries for dev build players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).withEntries().devBuildPlayers().one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(0)
  })

  it('should return leaderboard entries for dev build players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).withEntries().devBuildPlayers().one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.entries).toHaveLength(leaderboard.entries.length)
  })

  it('should return archived entries', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(10)
    const leaderboard = await new LeaderboardFactory([game]).one()
    const entries = await new LeaderboardEntryFactory(leaderboard, players).many(5)

    entries[0].deletedAt = new Date()
    entries[1].deletedAt = new Date()
    await em.persistAndFlush(entries)

    const resWithDeleted = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, withDeleted: '1' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(resWithDeleted.body.entries).toHaveLength(5)
    expect(resWithDeleted.body.entries.filter((entry: LeaderboardEntry) => entry.deletedAt !== null)).toHaveLength(2)
  })

  it('should filter leaderboard entries by prop keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(2)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const entry = await new LeaderboardEntryFactory(leaderboard, players).state((entry) => ({
      props: new Collection<LeaderboardEntryProp>(entry, [
        new LeaderboardEntryProp(entry, 'team', 'Blue')
      ])
    })).one()

    const otherEntry = await new LeaderboardEntryFactory(leaderboard, players).one()

    await em.persistAndFlush([leaderboard, entry, otherEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, propKey: 'team' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].id).toBe(entry.id)
  })

  it('should filter leaderboard entries by prop keys and values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(2)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const entry = await new LeaderboardEntryFactory(leaderboard, players).state((entry) => ({
      props: new Collection<LeaderboardEntryProp>(entry, [
        new LeaderboardEntryProp(entry, 'team', 'Blue')
      ])
    })).one()

    const otherEntry = await new LeaderboardEntryFactory(leaderboard, players).state((entry) => ({
      props: new Collection<LeaderboardEntryProp>(entry, [
        new LeaderboardEntryProp(entry, 'team', 'Red')
      ])
    })).one()

    const irrelevantEntry = await new LeaderboardEntryFactory(leaderboard, players).one()

    await em.persistAndFlush([leaderboard, entry, otherEntry, irrelevantEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, propKey: 'team', propValue: 'Blue' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].id).toBe(entry.id)
  })

  it('should return the correct positions for a mixed of archived, active and hidden entries when fitlering by alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(2)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false, sortMode: LeaderboardSortMode.ASC })).one()

    const entries = await new LeaderboardEntryFactory(leaderboard, [players[0]])
      .state((_, idx) => ({
        score: idx + 1,
        playerAlias: players[0].aliases[0]
      }))
      .many(3)

    const hiddenEntry = await new LeaderboardEntryFactory(leaderboard, [players[1]])
      .state(() => ({ score: 0, hidden: true }))
      .one()

    entries[0].deletedAt = new Date()
    entries[1].deletedAt = new Date()
    await em.persistAndFlush([...entries, hiddenEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, withDeleted: '1', aliasId: players[0].aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries[0].position).toBe(0)
    expect(res.body.entries[1].position).toBe(1)
    expect(res.body.entries[2].position).toBe(2)
  })

  it('should filter leaderboard entries by start date', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(3)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const today = new Date()
    const oldDate = subDays(today, 10)
    const recentDate = subDays(today, 3)

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: oldDate
    })).one()

    const recentEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: recentDate
    })).one()

    await em.persistAndFlush([leaderboard, oldEntry, recentEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, startDate: format(subDays(today, 5), 'yyyy-MM-dd') })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: recentEntry.id })
    ]))
  })

  it('should filter leaderboard entries by end date', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(3)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const today = new Date()
    const oldDate = subDays(today, 10)
    const recentDate = subDays(today, 3)
    const futureDate = addDays(today, 5)

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: oldDate
    })).one()

    const recentEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: recentDate
    })).one()

    const futureEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: futureDate
    })).one()

    await em.persistAndFlush([leaderboard, oldEntry, recentEntry, futureEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, endDate: format(addDays(today, 1), 'yyyy-MM-dd') })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: oldEntry.id }),
      expect.objectContaining({ id: recentEntry.id })
    ]))
  })

  it('should filter leaderboard entries by both start and end date', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).many(4)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const today = new Date()
    const veryOldDate = subDays(today, 15)
    const oldDate = subDays(today, 10)
    const recentDate = subDays(today, 3)
    const futureDate = addDays(today, 5)

    const veryOldEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: veryOldDate
    })).one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: oldDate
    })).one()

    const recentEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: recentDate
    })).one()

    const futureEntry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({
      createdAt: futureDate
    })).one()

    await em.persistAndFlush([leaderboard, veryOldEntry, oldEntry, recentEntry, futureEntry])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, startDate: format(subDays(today, 10), 'yyyy-MM-dd'), endDate: format(addDays(today, 1), 'yyyy-MM-dd') })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: oldEntry.id }),
      expect.objectContaining({ id: recentEntry.id })
    ]))
  })

  it('should filter leaderboard entries by player alias service', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const steamPlayers = await new PlayerFactory([game]).withSteamAlias().many(2)
    const usernamePlayers = await new PlayerFactory([game]).withUsernameAlias().many(2)
    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()

    const steamEntries = await new LeaderboardEntryFactory(leaderboard, steamPlayers).many(2)
    const usernameEntries = await new LeaderboardEntryFactory(leaderboard, usernamePlayers).many(2)

    await em.persistAndFlush([leaderboard, ...steamEntries, ...usernameEntries])

    const res = await request(app)
      .get(`/games/${game.id}/leaderboards/${leaderboard.id}/entries`)
      .query({ page: 0, service: 'steam' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries.every((entry: LeaderboardEntry) => entry.playerAlias.service === 'steam')).toBe(true)
  })
})
