import deletePlayers from '../../src/tasks/deletePlayers'
import PlayerFactory from '../fixtures/PlayerFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import { PlayerToDelete } from '../../src/entities/player-to-delete'
import Player from '../../src/entities/player'
import { EntityManager } from '@mikro-orm/mysql'

describe('deletePlayers', () => {
  beforeEach(async () => {
    await em.nativeDelete(PlayerToDelete, {})
  })

  it('should delete players from the PlayerToDelete table', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(3)
    await em.persistAndFlush(players)

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persistAndFlush(playersToDelete)

    expect(await em.count(PlayerToDelete)).toBe(3)
    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(3)

    await deletePlayers()

    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(0)
    expect(await em.count(PlayerToDelete)).toBe(0)
  })

  it('should process only up to 100 players at a time', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(150)
    await em.persistAndFlush(players)

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persistAndFlush(playersToDelete)

    expect(await em.count(PlayerToDelete)).toBe(150)

    await deletePlayers()

    // only 100 players should be deleted
    expect(await em.count(Player, { id: { $in: players.map((p) => p.id) } })).toBe(50)
    expect(await em.count(PlayerToDelete)).toBe(50)
  })

  it('should handle errors gracefully and continue processing', async () => {
    const [, game] = await createOrganisationAndGame()
    const players = await new PlayerFactory([game]).many(2)
    await em.persistAndFlush(players)

    const playersToDelete = players.map((player) => new PlayerToDelete(player))
    await em.persistAndFlush(playersToDelete)

    // after cascade delete, only 1 PlayerToDelete entry remains
    await em.removeAndFlush(players[0])
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
    await em.persistAndFlush(playersToDelete)

    vi.spyOn(EntityManager.prototype, 'removeAndFlush').mockRejectedValueOnce(new Error())

    await expect(deletePlayers()).resolves.not.toThrow()
  })
})
