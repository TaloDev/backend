import PlayerFactory from '../fixtures/PlayerFactory'
import { sub } from 'date-fns'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import deleteInactivePlayers from '../../src/tasks/deleteInactivePlayers'
import Player from '../../src/entities/player'
import UserFactory from '../fixtures/UserFactory'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'
import { randBoolean, randNumber } from '@ngneat/falso'
import PlayerAlias from '../../src/entities/player-alias'
import PlayerPresence from '../../src/entities/player-presence'
import PlayerAuth from '../../src/entities/player-auth'
import PlayerProp from '../../src/entities/player-prop'
import * as GlobalQueuesModule from '../../src/config/global-queues'
import getBillablePlayerCount from '../../src/lib/billing/getBillablePlayerCount'

describe('deleteInactivePlayers', () => {
  it('should delete inactive dev players older than 60 days', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 61 })
    })).devBuild().one()

    const otherPlayer = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 59 })
    })).devBuild().one()

    await em.persistAndFlush([owner, player, otherPlayer])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
      extra: {
        count: 1
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should delete inactive live players older than 90 days', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).one()

    const otherPlayer = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 89 })
    })).one()

    await em.persistAndFlush([owner, player, otherPlayer])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should delete players with auth', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).withTaloAlias().one()

    await em.persistAndFlush([owner, player])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)
  })

  it('should delete players with presence', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const presence = await new PlayerPresenceFactory(game).one()
    presence.player.lastSeenAt = sub(new Date(), { days: 91 })

    await em.persistAndFlush([owner, presence])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)
  })

  it('should delete all player data in clickhouse', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(async () => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).one()

    await em.persistAndFlush([owner, player])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(0)

    await vi.waitUntil(async () => {
      const updatedEventsCount = await clickhouse.query({
        query: 'SELECT count() as count FROM events',
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedEventPropsCount = await clickhouse.query({
        query: 'SELECT count() as count FROM event_props',
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedPlayerSessionsCount = await clickhouse.query({
        query: 'SELECT count() as count FROM player_sessions',
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedPlayerGameStatSnapshotsCount = await clickhouse.query({
        query: 'SELECT count() as count FROM player_game_stat_snapshots',
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return updatedEventsCount === 0 &&
        updatedEventPropsCount === 0 &&
        updatedPlayerSessionsCount === 0 &&
        updatedPlayerGameStatSnapshotsCount === 0
    })
  })

  it('should not delete inactive dev players when purgeDevPlayers is false', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: false, purgeLivePlayers: true })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 61 })
    })).devBuild().one()

    await em.persistAndFlush([owner, player])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })
    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED
    })
    expect(activity).toBeNull()
  })

  it('should not delete inactive live players when purgeLivePlayers is false', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: false })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).one()

    await em.persistAndFlush([owner, player])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })
    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED
    })
    expect(activity).toBeNull()
  })

  it('should delete inactive dev players older than the dev players retention setting', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true, purgeDevPlayersRetention: 30 })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 31 })
    })).devBuild().one()

    const otherPlayer = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 29 })
    })).devBuild().one()

    await em.persistAndFlush([owner, player, otherPlayer])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED,
      extra: {
        count: 1
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should delete inactive live players older than the live players retention', async () => {
    const [, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true, purgeLivePlayersRetention: 60 })
    const owner = await new UserFactory().owner().state(() => ({
      organisation: game.organisation
    })).one()

    const player = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 61 })
    })).one()

    const otherPlayer = await new PlayerFactory([game]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 59 })
    })).one()

    await em.persistAndFlush([owner, player, otherPlayer])
    await deleteInactivePlayers()

    const players = await em.repo(Player).find({ game })

    expect(players).toHaveLength(1)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should continue processing other games when one game throws an error', async () => {
    vi.spyOn(GlobalQueuesModule, 'getGlobalQueue').mockRejectedValueOnce(new Error())

    const [, game1] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
    const [, game2] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })

    const owner1 = await new UserFactory().owner().state(() => ({
      organisation: game1.organisation
    })).one()

    const owner2 = await new UserFactory().owner().state(() => ({
      organisation: game2.organisation
    })).one()

    const player1 = await new PlayerFactory([game1]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).one()

    const player2 = await new PlayerFactory([game2]).state(() => ({
      lastSeenAt: sub(new Date(), { days: 91 })
    })).one()

    await em.persistAndFlush([owner1, owner2, player1, player2])

    await deleteInactivePlayers()

    const players1 = await em.repo(Player).find({ game: game1 })
    const players2 = await em.repo(Player).find({ game: game2 })

    expect(players1).toHaveLength(1)
    expect(players2).toHaveLength(0)

    const activity1 = await em.repo(GameActivity).findOne({
      game: game1,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED
    })
    expect(activity1).toBeNull()

    const activity2 = await em.repo(GameActivity).findOne({
      game: game2,
      type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
      extra: {
        count: 1
      }
    })
    expect(activity2).not.toBeNull()
  })

  describe('integration tests', () => {
    beforeEach(async () => {
      const allPlayers = await em.repo(Player).findAll()
      await em.removeAndFlush(allPlayers)
    })

    it('should delete over 100 players with presence and auth', async () => {
      const [organisation, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
      const owner = await new UserFactory().owner().state(() => ({ organisation })).one()

      const playerCount = randNumber({ min: 100, max: 200 })

      const players = await new PlayerFactory([game]).state(() => ({
        lastSeenAt: sub(new Date(), { days: 91 })
      }))
        .withTaloAlias()
        .withPresence()
        .many(playerCount)

      await em.persistAndFlush([owner, ...players])

      await deleteInactivePlayers()
      em.clear()

      const activity = await em.repo(GameActivity).findOne({
        game,
        type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED
      })
      expect(activity?.extra).toStrictEqual({
        count: playerCount
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
      const games = await Promise.all([
        em.fork(),
        em.fork(),
        em.fork()
      ].map(async (fork) => {
        const [organisation, game] = await createOrganisationAndGame({}, { purgeDevPlayers: true, purgeLivePlayers: true })
        const owner = await new UserFactory().owner().state(() => ({ organisation })).one()

        const playerCount = randNumber({ min: 100, max: 200 })
        const players = await new PlayerFactory([game]).state(() => ({
          lastSeenAt: sub(new Date(), { days: 91 }),
          devBuild: randBoolean()
        }))
          .withTaloAlias()
          .withPresence()
          .many(playerCount)

        await fork.persistAndFlush([owner, ...players])
        return game
      }))

      await deleteInactivePlayers()
      em.clear()

      for (const game of games) {
        const devActivity = await em.repo(GameActivity).findOne({
          game,
          type: GameActivityType.INACTIVE_DEV_PLAYERS_DELETED
        })
        expect(devActivity).not.toBeNull()

        const liveActivity = await em.repo(GameActivity).findOne({
          game,
          type: GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED
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
