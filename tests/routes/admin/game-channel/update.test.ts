import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import GameChannelFactory from '../../../fixtures/GameChannelFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game channel admin API - update', () => {
  it('should update a game channel for a key with the write:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/admin/v1/game-channels/${channel.id}`)
      .send({ name: 'Updated channel', props: [{ key: 'test', value: 'value' }] })
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.name).toBe('Updated channel')

    const activity = await em.repo(GameActivity).findOneOrFail({
      type: GameActivityType.GAME_CHANNEL_UPDATED,
      game: apiKey.game,
      adminAPIKey: apiKey,
    })
    expect(activity.extra.channelName).toBe('Updated channel')
  })

  it('should return 404 for a non-existent channel', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const res = await request(app)
      .put('/admin/v1/game-channels/99999')
      .send({ name: 'Updated channel' })
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
      .put(`/admin/v1/game-channels/${channel.id}`)
      .send({ name: 'Updated channel' })
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should return 403 for a key missing the write:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/admin/v1/game-channels/${channel.id}`)
      .send({ name: 'Updated channel' })
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('write:gameChannels')
  })
})
