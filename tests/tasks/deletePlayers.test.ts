import { EntityManager } from '@mikro-orm/mysql'
import DeletedPlayer from '../../src/entities/deleted-player.js'
import { PlayerToDelete } from '../../src/entities/player-to-delete.js'
import Player from '../../src/entities/player.js'
import deletePlayers from '../../src/tasks/deletePlayers.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('deletePlayers', () => {
  beforeEach(async () => {
    await em.nativeDelete(PlayerToDelete, {})
    await em.nativeDelete(DeletedPlayer, {})
  })

  it('should delete players from the PlayerToDelete table', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(3)
    await em.persist(players).flush()

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persist(playersToDelete).flush()

    expect(await em.count(PlayerToDelete)).toBe(3)
    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(3)

    await deletePlayers()

    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(0)
    expect(await em.count(PlayerToDelete)).toBe(0)
    expect(await em.count(DeletedPlayer)).toBe(3)
  })

  it('should process only up to 100 players at a time', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(150)
    await em.persist(players).flush()

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persist(playersToDelete).flush()

    expect(await em.count(PlayerToDelete)).toBe(150)

    await deletePlayers()

    // only 100 players should be deleted
    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(50)
    expect(await em.count(PlayerToDelete)).toBe(50)
  })

  it('should handle errors gracefully and continue processing', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(2)
    await em.persist(players).flush()

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persist(playersToDelete).flush()

    // after cascade delete, only 1 PlayerToDelete entry remains
    await em.remove(players[0]).flush()
    expect(await em.count(PlayerToDelete)).toBe(1)

    await deletePlayers()

    // the second player should still be deleted successfully
    expect(await em.count(Player, { id: players[1].id })).toBe(0)
    expect(await em.count(PlayerToDelete)).toBe(0)
  })

  it('should not fail if there are no players to delete', async () => {
    expect(await em.count(PlayerToDelete)).toBe(0)
    await expect(deletePlayers()).resolves.not.toThrow()
  })

  it('should handle deletion errors', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(10)
    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persist(playersToDelete).flush()

    vi.spyOn(EntityManager.prototype, 'transactional').mockRejectedValueOnce(new Error())

    await expect(deletePlayers()).resolves.not.toThrow()
    // no DeletedPlayer rows written when the transaction failed
    expect(await em.count(DeletedPlayer)).toBe(0)
  })

  it('should copy the game, devBuild and createdAt from each deleted player', async () => {
    const [, game] = await createOrganisationAndGame()
    const livePlayer = await new PlayerFactory([game]).one()
    const devPlayer = await new PlayerFactory([game]).devBuild().one()
    await em.persist([livePlayer, devPlayer]).flush()

    const playersToDelete = [livePlayer, devPlayer].map((player) => new PlayerToDelete(player))
    await em.persist(playersToDelete).flush()

    await deletePlayers()

    const deletedPlayers = await em.repo(DeletedPlayer).findAll({ orderBy: { devBuild: 'desc' } })
    expect(deletedPlayers).toHaveLength(2)

    const [devDeleted, liveDeleted] = deletedPlayers

    expect(devDeleted.game.id).toBe(game.id)
    expect(devDeleted.devBuild).toBe(true)
    expect(devDeleted.createdAt.getTime()).toBeCloseTo(devPlayer.createdAt.getTime(), -3)

    expect(liveDeleted.game.id).toBe(game.id)
    expect(liveDeleted.devBuild).toBe(false)
    expect(liveDeleted.createdAt.getTime()).toBeCloseTo(livePlayer.createdAt.getTime(), -3)
  })
})
