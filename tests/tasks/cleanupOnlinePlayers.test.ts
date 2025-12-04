import { addMinutes, isToday, subDays, subMinutes } from 'date-fns'
import cleanupOnlinePlayers from '../../src/tasks/cleanupOnlinePlayers'
import PlayerFactory from '../fixtures/PlayerFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import PlayerSession, { ClickHousePlayerSession } from '../../src/entities/player-session'
import { formatDateForClickHouse } from '../../src/lib/clickhouse/formatDateTime'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'
import assert from 'node:assert'
import PlayerPresence from '../../src/entities/player-presence'
import Player from '../../src/entities/player'

describe('cleanupOnlinePlayers', () => {
  beforeEach(() => {
    // create an unfinished session from two days ago (to account for utc)
    vi.setSystemTime(subDays(new Date(), 2))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should delete unfinished sessions older than 1 day', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const session = new PlayerSession()
    session.construct(player)
    await player.insertSession(clickhouse, session)

    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' and ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    await cleanupOnlinePlayers()

    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 0
    })
  })

  it('should set presence to offline if the latest session ended after the presence was updated', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subDays(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persistAndFlush(player)

    assert(player.presence)

    // simulate a session that ended after the presence was updated
    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = player.presence.updatedAt
    session.endedAt = addMinutes(session.startedAt, 10)
    await player.insertSession(clickhouse, session)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOne({ player: player.id })
    assert(updatedPresence)
    expect(updatedPresence.online).toBe(false)
    expect(isToday(updatedPresence.updatedAt)).toBe(true)
  })

  it('does not set presence to offline if the latest session ended before the presence was updated', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subDays(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persistAndFlush(player)

    assert(player.presence)

    // simulate a session that ended before the presence was updated
    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = session.endedAt = subMinutes(player.presence.updatedAt, 10)
    await player.insertSession(clickhouse, session)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOne({ player: player.id })
    assert(updatedPresence)
    expect(updatedPresence.online).toBe(true)
    expect(isToday(updatedPresence.updatedAt)).toBe(false)
  })

  it('should not update presence if no sessions are found', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subDays(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persistAndFlush(player)

    assert(player.presence)
    const originalUpdatedAt = player.presence.updatedAt
    originalUpdatedAt.setMilliseconds(0) // no milliseconds in db

    // no sessions inserted for this player

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOne({ player: player.id })
    assert(updatedPresence)
    expect(updatedPresence.online).toBe(true)
    expect(updatedPresence.updatedAt).toEqual(originalUpdatedAt)
  })

  it('should delete presence that no longer has a player', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subDays(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persistAndFlush(player)

    assert(player.presence)
    const originalPresenceId = player.presence.id

    await em.nativeDelete(Player, player.id)

    const originalPresence = await em.repo(PlayerPresence).findOne(originalPresenceId)
    assert(originalPresence)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.refresh(originalPresence)
    expect(updatedPresence).toBeNull()
  })

  it('should delete sessions for a deleted player', async () => {
    // Use the time from beforeEach (2 days ago) to ensure session is old enough
    const deletedPlayerId = crypto.randomUUID()

    await clickhouse.insert({
      table: 'player_sessions',
      values: {
        player_id: deletedPlayerId,
        player_alias_id: 123,
        started_at: formatDateForClickHouse(subDays(new Date(), 2)),
        ended_at: null,
        dev_build: true
      },
      format: 'JSON'
    })

    // verify the session was inserted
    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${deletedPlayerId}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    await cleanupOnlinePlayers()

    // verify the session was deleted
    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${deletedPlayerId}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 0
    })
  })
})
