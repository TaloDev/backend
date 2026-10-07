import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import GameChannelFactory from '../../../fixtures/GameChannelFactory.js'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory.js'
import { createAdminAPIKey } from '../../../utils/createAdminAPIKey.js'

describe('Game channel admin API - storage', () => {
  it('should return a list of storage props for a key with the read:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const storageProps = await new GameChannelStoragePropFactory(channel).many(5)
    await em.persist([channel, ...storageProps]).flush()

    const res = await request(app)
      .get(`/admin/v1/game-channels/${channel.id}/storage`)
      .auth(keyString, { type: 'bearer' })
      .expect(200)

    expect(res.body.channelName).toBe(channel.name)
    expect(res.body.storageProps).toHaveLength(5)
    expect(res.body.count).toBe(5)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should return 404 for a non-existent channel', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const res = await request(app)
      .get('/admin/v1/game-channels/99999/storage')
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should return 404 for a channel in another game', async () => {
    const { keyString } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])
    const { apiKey: otherKey } = await createAdminAPIKey([AdminAPIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(otherKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .get(`/admin/v1/game-channels/${channel.id}/storage`)
      .auth(keyString, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should return 403 for a key missing the read:gameChannels scope', async () => {
    const { apiKey, keyString } = await createAdminAPIKey([AdminAPIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .get(`/admin/v1/game-channels/${channel.id}/storage`)
      .auth(keyString, { type: 'bearer' })
      .expect(403)

    expect(res.body.message).toContain('read:gameChannels')
  })
})
