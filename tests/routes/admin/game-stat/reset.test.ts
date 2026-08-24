import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import PlayerGameStat from '../../../../src/entities/player-game-stat.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

describe('Game stat admin API - reset', () => {
  it('should reset all player stats for a key with the write:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ global: true, globalValue: 500, defaultValue: 0 }))
      .one()

    const players = await new PlayerFactory([apiKey.game]).many(3)
    const playerStats = await Promise.all(
      players.map((player) =>
        new PlayerGameStatFactory()
          .construct(player, stat)
          .state(() => ({ value: 50 }))
          .one(),
      ),
    )
    await em.persist(playerStats).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-stats/${stat.id}/player-stats`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(3)

    const remainingPlayerStats = await em.repo(PlayerGameStat).find({ stat })
    expect(remainingPlayerStats).toHaveLength(0)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(0)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_STAT_RESET,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
    expect(activity.extra.display?.['Reset mode']).toBe('All players')
    expect(activity.extra.display?.['Deleted count']).toBe(3)
  })

  it('should return 403 for a key missing the write:stats scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_STATS])

    const stat = await new GameStatFactory([apiKey.game]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-stats/${stat.id}/player-stats`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:stats')
  })

  it('should return 404 for a stat that does not belong to the key game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_STATS])
    const [, otherGame] = await createOrganisationAndGame()

    const stat = await new GameStatFactory([otherGame]).one()
    await em.persist(stat).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-stats/${stat.id}/player-stats`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
