import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import GameChannel from '../../../../src/entities/game-channel.js'
import GameChannelFactory from '../../../fixtures/GameChannelFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game channel admin API - delete', () => {
  it('should delete a game channel for a key with the write:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-channels/${channel.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(204)

    expect(res.body).toStrictEqual({})

    const deleted = await em.repo(GameChannel).find({ id: channel.id })
    expect(deleted).toHaveLength(0)

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_CHANNEL_DELETED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.extra.channelName).toBe(channel.name)
  })

  it('should return 404 for a non-existent channel', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const res = await request(app)
      .delete('/admin/v1/game-channels/99999')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should return 404 for a channel in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(otherKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-channels/${channel.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should return 403 for a key missing the write:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .delete(`/admin/v1/game-channels/${channel.id}`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameChannels')
  })
})
