import { EntityManager } from '@mikro-orm/mysql'
import { randBoolean, randNumber, randWord } from '@ngneat/falso'
import { sub } from 'date-fns'
import { v4 } from 'uuid'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity'
import Player from '../../src/entities/player'
import PlayerAlias from '../../src/entities/player-alias'
import PlayerAuth from '../../src/entities/player-auth'
import PlayerPresence from '../../src/entities/player-presence'
import PlayerProp from '../../src/entities/player-prop'
import { PlayerToDelete } from '../../src/entities/player-to-delete'
import getBillablePlayerCount from '../../src/lib/billing/getBillablePlayerCount'
import { formatDateForClickHouse } from '../../src/lib/clickhouse/formatDateTime'
import deleteInactivePlayers from '../../src/tasks/deleteInactivePlayers'
import deletePlayers from '../../src/tasks/deletePlayers'
import EventFactory from '../fixtures/EventFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'
import UserFactory from '../fixtures/UserFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

describe('deleteInactivePlayers', () => {
  beforeEach(async () => {
    await em.nativeDelete(PlayerToDelete, {})
  })

  it('should delete inactive dev players older than 60 days for deletion', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 61 }),
      }))
      .devBuild()
      .one()

    const otherPlayer = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 59 }),
      }))
      .devBuild()
      .one()

    await em.persist([owner, player, otherPlayer]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
      extra: {
        count: 1,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should delete inactive live players older than 90 days', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .one()

    const otherPlayer = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 89 }),
      }))
      .one()

    await em.persist([owner, player, otherPlayer]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should delete players with auth', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .withTaloAlias()
      .one()

    await em.persist([owner, player]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)
  })

  it('should delete players with presence', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const presence = await new PlayerPresenceFactory(game).one()
    presence.player.lastSeenAt = sub(new Date(), { days: 91 })

    await em.persist([owner, presence]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)
  })

  it('should delete all player data in clickhouse', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(async () => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .one()

    const playerAlias = player.aliases[0]

    // seed events
    const events = await new EventFactory([player])
      .state(() => ({
        playerAlias,
        props: [{ key: 'word', value: randWord() }],
      }))
      .many(5)

    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })
    await clickhouse.insert({
      table: 'event_props',
      values: events.flatMap((event) => event.getInsertableProps()),
      format: 'JSONEachRow',
    })

    // seed sessions
    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(5)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: playerAlias.id,
          game_id: game.id,
          dev_build: true,
          started_at: formatDateForClickHouse(new Date()),
          ended_at: formatDateForClickHouse(new Date()),
        })),
      format: 'JSONEachRow',
    })

    // seed stat snapshots
    await clickhouse.insert({
      table: 'player_game_stat_snapshots',
      values: Array(5)
        .fill({})
        .map((_, idx) => ({
          id: v4(),
          player_alias_id: playerAlias.id,
          game_stat_id: 1,
          change: 1,
          value: idx,
          global_value: idx,
          created_at: formatDateForClickHouse(new Date()),
        })),
      format: 'JSONEachRow',
    })

    await em.persist([owner, player]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)

    await vi.waitUntil(async () => {
      const updatedEventsCount = await clickhouse
        .query({
          query: `SELECT count() as count FROM events WHERE player_alias_id = ${playerAlias.id}`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedEventPropsCount = await clickhouse
        .query({
          query: `SELECT count() as count FROM event_props ep INNER JOIN events e ON e.id = ep.event_id WHERE e.player_alias_id = ${playerAlias.id}`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedPlayerSessionsCount = await clickhouse
        .query({
          query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}'`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedPlayerGameStatSnapshotsCount = await clickhouse
        .query({
          query: `SELECT count() as count FROM player_game_stat_snapshots WHERE player_alias_id = ${playerAlias.id}`,
          format: 'JSONEachRow',
        })
        .then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return (
        updatedEventsCount === 0 &&
        updatedEventPropsCount === 0 &&
        updatedPlayerSessionsCount === 0 &&
        updatedPlayerGameStatSnapshotsCount === 0
      )
    })
  })

  it('should not delete inactive dev players when purgeDevPlayers is false', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: false, purgeLivePlayers: true },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 61 }),
      }))
      .devBuild()
      .one()

    await em.persist([owner, player]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })
    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
    })
    expect(activity).toBeNull()
  })

  it('should not delete inactive live players when purgeLivePlayers is false', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: false },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .one()

    await em.persist([owner, player]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })
    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
    })
    expect(activity).toBeNull()
  })

  it('should delete inactive dev players older than the dev players retention setting', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true, purgeDevPlayersRetention: 30 },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 31 }),
      }))
      .devBuild()
      .one()

    const otherPlayer = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 29 }),
      }))
      .devBuild()
      .one()

    await em.persist([owner, player, otherPlayer]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
      extra: {
        count: 1,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should delete inactive live players older than the live players retention', async () => {
    const [, game] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true, purgeLivePlayersRetention: 60 },
    )
    const owner = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game.organisation,
      }))
      .one()

    const player = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 61 }),
      }))
      .one()

    const otherPlayer = await new PlayerFactory([game])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 59 }),
      }))
      .one()

    await em.persist([owner, player, otherPlayer]).flush()
    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1,
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should continue processing other games when one game throws an error', async () => {
    const [, game1] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )
    const [, game2] = await createOrganisationAndGame(
      {},
      { purgeDevPlayers: true, purgeLivePlayers: true },
    )

    const owner1 = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game1.organisation,
      }))
      .one()

    const owner2 = await new UserFactory()
      .owner()
      .state(() => ({
        organisation: game2.organisation,
      }))
      .one()

    const player1 = await new PlayerFactory([game1])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .one()

    const player2 = await new PlayerFactory([game2])
      .state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 }),
      }))
      .one()

    await em.persist([owner1, owner2, player1, player2]).flush()

    // makes persisting the first player_to_delete fail
    vi.spyOn(EntityManager.prototype, 'persistAndFlush').mockRejectedValueOnce(new Error())

    await deleteInactivePlayers()
    // actually delete the players
    await deletePlayers()

    const players1 = await em.repo(Player).find({ game: game1 })
    const players2 = await em.repo(Player).find({ game: game2 })

    expect(players1).toHaveLength(1)
    expect(players2).toHaveLength(0)

    const activity1 = await em.repo(GameActivity).findOne({
      game: game1,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
    })
    expect(activity1).toBeNull()

    const activity2 = await em.repo(GameActivity).findOne({
      game: game2,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1,
      },
    })
    expect(activity2).not.toBeNull()
  })

  describe('integration tests', () => {
    beforeEach(async () => {
      const allPlayers = await em.repo(Player).findAll()
      await em.remove(allPlayers).flush()
    })

    it('should delete over 100 players with presence and auth', async () => {
      const [organisation, game] = await createOrganisationAndGame(
        {},
        { purgeDevPlayers: true, purgeLivePlayers: true },
      )
      const owner = await new UserFactory()
        .owner()
        .state(() => ({ organisation }))
        .one()

      const playerCount = randNumber({ min: 100, max: 200 })

      const players = await new PlayerFactory([game])
        .state(() => ({
          lastSeenAt: sub(new Date(), { days: 91 }),
        }))
        .withTaloAlias()
        .withPresence()
        .many(playerCount)

      await em.persistAndFlush([owner, ...players])

      await deleteInactivePlayers()

      // actually delete the players
      let remaining = await em.repo(PlayerToDelete).count()
      while (remaining > 0) {
        await deletePlayers()
        remaining = await em.repo(PlayerToDelete).count()
      }

      em.clear()

      const activity = await em.repo(GameActivity).findOne({
        game,
        type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      })
      expect(activity?.extra).toStrictEqual({
        count: playerCount,
      })

      const updatedPlayerCount = await em.repo(Player).count()
      expect(updatedPlayerCount).toBe(0)

      const updatedAliasCount = await em.repo(PlayerAlias).count()
      expect(updatedAliasCount).toBe(0)

      const updatedPresenceCount = await em.repo(PlayerPresence).count()
      expect(updatedPresenceCount).toBe(0)

      const updatedAuthCount = await em.repo(PlayerAuth).count()
      expect(updatedAuthCount).toBe(0)

      const updatedPropCount = await em.repo(PlayerProp).count()
      expect(updatedPropCount).toBe(0)

      // just in case
      expect(await getBillablePlayerCount(em, game.organisation)).toBe(0)
    })

    it('should delete players across multiple games', async () => {
      const games = await Promise.all(
        [em.fork(), em.fork(), em.fork()].map(async (fork) => {
          const [organisation, game] = await createOrganisationAndGame(
            {},
            { purgeDevPlayers: true, purgeLivePlayers: true },
          )
          const owner = await new UserFactory()
            .owner()
            .state(() => ({ organisation }))
            .one()

          const playerCount = randNumber({ min: 100, max: 200 })
          const players = await new PlayerFactory([game])
            .state(() => ({
              lastSeenAt: sub(new Date(), { days: 91 }),
              devBuild: randBoolean(),
            }))
            .withTaloAlias()
            .withPresence()
            .many(playerCount)

          await fork.persist([owner, ...players]).flush()
          return game
        }),
      )

      await deleteInactivePlayers()

      // actually delete the players
      let remaining = await em.repo(PlayerToDelete).count()
      while (remaining > 0) {
        await deletePlayers()
        remaining = await em.repo(PlayerToDelete).count()
      }

      em.clear()

      for (const game of games) {
        const devActivity = await em.repo(GameActivity).findOne({
          game,
          type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
        })
        expect(devActivity).not.toBeNull()

        const liveActivity = await em.repo(GameActivity).findOne({
          game,
          type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
        })
        expect(liveActivity).not.toBeNull()

        // just in case
        expect(await getBillablePlayerCount(em, game.organisation)).toBe(0)
      }

      const updatedPlayerCount = await em.repo(Player).count()
      expect(updatedPlayerCount).toBe(0)

      const updatedAliasCount = await em.repo(PlayerAlias).count()
      expect(updatedAliasCount).toBe(0)

      const updatedPresenceCount = await em.repo(PlayerPresence).count()
      expect(updatedPresenceCount).toBe(0)

      const updatedAuthCount = await em.repo(PlayerAuth).count()
      expect(updatedAuthCount).toBe(0)

      const updatedPropCount = await em.repo(PlayerProp).count()
      expect(updatedPropCount).toBe(0)
    })
  })
})
