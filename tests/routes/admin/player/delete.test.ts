import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import Player from '../../../../src/entities/player.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Player admin API - delete', () => {
  it('should delete a player for a key with the write:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    await request(app)
      .delete(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(204)

    expect(await em.repo(Player).find({ id: player.id })).toHaveLength(0)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.PLAYER_DELETED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.adminAPIKey?.id).toBe(apiKey.id)
  })

  it('should return 403 for a key missing the write:players scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .delete(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:players')
  })

  it('should return 404 for a non-existent player', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .delete('/admin/v1/players/non-existent-id')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should return 404 for a player in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([otherKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .delete(`/admin/v1/players/${player.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
    expect(await em.repo(Player).find({ id: player.id })).toHaveLength(1)
  })
})
