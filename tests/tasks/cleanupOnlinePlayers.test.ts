import { addHours, addMinutes, isToday, subDays, subMinutes } from 'date-fns'
import cleanupOnlinePlayers from '../../src/tasks/cleanupOnlinePlayers'
import PlayerFactory from '../fixtures/PlayerFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import PlayerSession, { ClickHousePlayerSession } from '../../src/entities/player-session'
import { formatDateForClickHouse } from '../../src/lib/clickhouse/formatDateTime'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'
import assert from 'node:assert'
import PlayerPresence from '../../src/entities/player-presence'

describe('cleanupOnlinePlayers', () => {
  beforeEach(() => {
    // create an unfinished session from two days ago (to account for utc)
    vi.setSystemTime(subDays(new Date(), 2))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should remove an unfinished session if a close event is found', async () => {
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

    // create a socket closed event
    const closedAt = addMinutes(session.startedAt, 5)
    await clickhouse.insert({
      table: 'socket_events',
      values: {
        event_type: 'close',
        req_or_res: 'req',
        code: null,
        game_id: game.id,
        player_alias_id: player.aliases[0].id,
        dev_build: false,
        created_at: formatDateForClickHouse(closedAt)
      },
      format: 'JSON'
    })

    await cleanupOnlinePlayers()

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    assert(finishedSession?.ended_at)
    expect(new Date(finishedSession.ended_at).getTime()).toBe(closedAt.getTime())
  })

  it('should use the latest event if a close event is not found to use as the end time', async () => {
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

    // create a random event to use as their last event
    const createdAt = addMinutes(session.startedAt, 5)
    await clickhouse.insert({
      table: 'socket_events',
      values: {
        event_type: 'v1.channels.message',
        req_or_res: 'req',
        code: null,
        game_id: game.id,
        player_alias_id: player.aliases[0].id,
        dev_build: false,
        created_at: formatDateForClickHouse(createdAt)
      },
      format: 'JSON'
    })

    await cleanupOnlinePlayers()

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    assert(finishedSession?.ended_at)
    expect(new Date(finishedSession.ended_at).getTime()).toBe(createdAt.getTime())
  })

  it('should add a minute to the started_at if there are no events for the session', async () => {
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

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    assert(finishedSession?.ended_at)
    expect(new Date(finishedSession.ended_at).getTime()).toBe((addMinutes(session.startedAt, 1)).getTime())
  })

  it('should not use events from any newer sessions', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const session = new PlayerSession()
    session.construct(player)
    await player.insertSession(clickhouse, session)

    vi.setSystemTime(addHours(new Date(), 1))

    const sessionSinceOriginal = new PlayerSession()
    sessionSinceOriginal.construct(player)
    sessionSinceOriginal.endSession()
    await player.insertSession(clickhouse, sessionSinceOriginal)

    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' and ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    // socket event for the latest session, not the unfinished one
    const createdAt = addMinutes(sessionSinceOriginal.startedAt, 5)
    await clickhouse.insert({
      table: 'socket_events',
      values: {
        event_type: 'v1.channels.message',
        req_or_res: 'req',
        code: null,
        game_id: game.id,
        player_alias_id: player.aliases[0].id,
        dev_build: false,
        created_at: formatDateForClickHouse(createdAt)
      },
      format: 'JSON'
    })

    await cleanupOnlinePlayers()

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' ORDER BY started_at ASC`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    // the only event was part of the latest session, not the original
    assert(finishedSession?.ended_at)
    expect(new Date(finishedSession.ended_at).getTime()).toBe(addMinutes(session.startedAt, 1).getTime())
  })

  it('should not use events that were created before the session', async () => {
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

    // random event created before the session started
    const createdAt = subMinutes(session.startedAt, 5)
    await clickhouse.insert({
      table: 'socket_events',
      values: {
        event_type: 'v1.channels.message',
        req_or_res: 'req',
        code: null,
        game_id: game.id,
        player_alias_id: player.aliases[0].id,
        dev_build: false,
        created_at: formatDateForClickHouse(createdAt)
      },
      format: 'JSON'
    })

    await cleanupOnlinePlayers()

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    assert(finishedSession?.ended_at)
    // no events during the session, so it should be set to 1 minute after startedAt
    expect(new Date(finishedSession.ended_at).getTime()).toBe((addMinutes(session.startedAt, 1)).getTime())
  })

  it('should not allow the session length to be less than a minute', async () => {
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

    const createdAt = session.startedAt
    await clickhouse.insert({
      table: 'socket_events',
      values: {
        event_type: 'v1.channels.message',
        req_or_res: 'req',
        code: null,
        game_id: game.id,
        player_alias_id: player.aliases[0].id,
        dev_build: false,
        created_at: formatDateForClickHouse(createdAt)
      },
      format: 'JSON'
    })

    await cleanupOnlinePlayers()

    let finishedSession: ClickHousePlayerSession | undefined
    await vi.waitUntil(async () => {
      finishedSession = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>()).then((res) => res[0])
      return !!finishedSession
    })

    assert(finishedSession?.ended_at)
    // if session length is less than a minute, it should be set to 1 minute after startedAt
    expect(new Date(finishedSession.ended_at).getTime()).toBe((addMinutes(session.startedAt, 1)).getTime())
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
})
