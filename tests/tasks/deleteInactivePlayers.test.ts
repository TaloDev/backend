import PlayerFactory from '../fixtures/PlayerFactory'
import { sub } from 'date-fns'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import deleteInactivePlayers from '../../src/tasks/deleteInactivePlayers'
import Player from '../../src/entities/player'
import UserFactory from '../fixtures/UserFactory'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity'
import PlayerPresenceFactory from '../fixtures/PlayerPresenceFactory'

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

      return updatedEventsCount === 0 &&
        updatedEventPropsCount === 0 &&
        updatedPlayerSessionsCount === 0
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
})
