import { addMinutes, isToday, subDays, subHours, subMinutes } from 'date-fns'
import cleanupOnlinePlayers from '../../src/tasks/cleanupOnlinePlayers'
import PlayerFactory from '../fixtures/PlayerFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import PlayerSession, { ClickHousePlayerSession } from '../../src/entities/player-session'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'
import assert from 'node:assert'
import PlayerPresence from '../../src/entities/player-presence'
import Player from '../../src/entities/player'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import { APIKeyScope } from '../../src/entities/api-key'
import createTestSocket from '../utils/createTestSocket'
import { setSocketInstance } from '../../src/socket/socketRegistry'

describe('cleanupOnlinePlayers', () => {
  beforeEach(() => {
    // create an unfinished session from two days ago (to account for utc)
    vi.setSystemTime(subDays(new Date(), 2))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should delete unfinished session when marking presence offline', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)

    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = player.presence.updatedAt
    session.endedAt = null
    await player.insertSession(clickhouse, session)

    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' and ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
    expect(updatedPresence.online).toBe(false)

    await vi.waitFor(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      expect(sessions.length).toBe(0)
    })
  })

  it('should set presence to offline if the latest session ended after the presence was updated', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)

    // simulate a session that ended after the presence was updated
    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = player.presence.updatedAt
    session.endedAt = addMinutes(session.startedAt, 10)
    await player.insertSession(clickhouse, session)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
    expect(updatedPresence.online).toBe(false)
    expect(isToday(updatedPresence.updatedAt)).toBe(true)
  })

  it('marks presence offline even if the session ended before the presence was updated, when presence is stale', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)

    // simulate a session that ended before the presence was updated
    // this old session won't be found because it's older than the cutoff time
    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = session.endedAt = subMinutes(player.presence.updatedAt, 10)
    await player.insertSession(clickhouse, session)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
    // should be marked offline because:
    // 1. presence is stale (>30 min old)
    // 2. no active WebSocket
    // 3. no recent session found (session is too old to be in query results)
    expect(updatedPresence.online).toBe(false)
  })

  it('should mark presence offline if no sessions are found and presence is stale', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)

    // no sessions inserted for this player

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
    // Should be marked offline because presence is stale and no session exists
    expect(updatedPresence.online).toBe(false)
  })

  it('should delete presence that no longer has a player', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)
    const originalPresenceId = player.presence.id

    await em.nativeDelete(Player, player.id)

    const originalPresence = await em.repo(PlayerPresence).findOneOrFail(originalPresenceId)

    await cleanupOnlinePlayers()

    const updatedPresence = await em.refresh(originalPresence)
    expect(updatedPresence).toBeNull()
  })

  it('should not delete sessions when there is no presence to process', async () => {
    vi.useRealTimers()

    // player without presence
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    // unfinished session
    const session = new PlayerSession()
    session.construct(player)
    await player.insertSession(clickhouse, session)

    // verify the session was inserted
    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    await cleanupOnlinePlayers()

    // session should NOT be deleted because there's no presence to mark offline
    const sessions = await clickhouse.query({
      query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickHousePlayerSession>())
    expect(sessions.length).toBe(1)
  })

  it('should handle empty state when no sessions or presence need cleanup', async () => {
    vi.useRealTimers()

    // no data
    await cleanupOnlinePlayers()
    expect(true).toBe(true)
  })

  it('should not mark a player as offline if they have an active socket connection', async () => {
    vi.useRealTimers()

    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client, wss) => {
      await client.identify(identifyMessage)

      const presence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })

      // manually update the presence to be old enough to be picked up for cleanup
      await em.nativeUpdate(PlayerPresence, { id: presence.id }, {
        updatedAt: subHours(new Date(), 2)
      })

      setSocketInstance(wss)

      await cleanupOnlinePlayers()

      const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
      // should remain online due to active socket connection
      expect(updatedPresence.online).toBe(true)
    })
  })

  it('should handle multiple online players and find the oldest updatedAt', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()

    // three players with different updatedAt times
    const player1 = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 5) }))
          .one()
      }))
      .one()

    const player2 = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 3) }))
          .one()
      }))
      .one()

    const player3 = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()

    em.persist([player1, player2, player3])
    await em.flush()

    assert(player1.presence)
    assert(player2.presence)
    assert(player3.presence)

    // sessions for each player that ended after their presence was updated
    const session1 = new PlayerSession()
    session1.construct(player1)
    session1.startedAt = player1.presence.updatedAt
    session1.endedAt = addMinutes(session1.startedAt, 10)
    await player1.insertSession(clickhouse, session1)

    const session2 = new PlayerSession()
    session2.construct(player2)
    session2.startedAt = player2.presence.updatedAt
    session2.endedAt = addMinutes(session2.startedAt, 10)
    await player2.insertSession(clickhouse, session2)

    const session3 = new PlayerSession()
    session3.construct(player3)
    session3.startedAt = player3.presence.updatedAt
    session3.endedAt = addMinutes(session3.startedAt, 10)
    await player3.insertSession(clickhouse, session3)

    await cleanupOnlinePlayers()

    const updatedPresence1 = await em.repo(PlayerPresence).findOneOrFail({ player: player1.id })
    expect(updatedPresence1.online).toBe(false)

    const updatedPresence2 = await em.repo(PlayerPresence).findOneOrFail({ player: player2.id })
    expect(updatedPresence2.online).toBe(false)

    const updatedPresence3 = await em.repo(PlayerPresence).findOneOrFail({ player: player3.id })
    expect(updatedPresence3.online).toBe(false)
  })

  it('should mark presence offline if session never ended but presence is stale and no active socket', async () => {
    vi.useRealTimers()

    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game])
      .state(async (player) => ({
        presence: await new PlayerPresenceFactory(player.game)
          .online()
          .state(() => ({ updatedAt: subHours(new Date(), 2) }))
          .one()
      }))
      .one()
    await em.persist(player).flush()

    assert(player.presence)

    // simulate a session that never properly ended (ended_at is null)
    // this happens when WebSocket disconnects improperly
    const session = new PlayerSession()
    session.construct(player)
    session.startedAt = player.presence.updatedAt
    session.endedAt = null // never ended!
    await player.insertSession(clickhouse, session)

    await vi.waitUntil(async () => {
      const sessions = await clickhouse.query({
        query: `SELECT * FROM player_sessions WHERE player_id = '${player.id}' AND ended_at IS NULL`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHousePlayerSession>())
      return sessions.length === 1
    })

    await cleanupOnlinePlayers()

    const updatedPresence = await em.repo(PlayerPresence).findOneOrFail({ player: player.id })
    // should be marked offline even though session never ended
    // because presence is stale (>30 min) and no active WebSocket
    expect(updatedPresence.online).toBe(false)
  })
})
