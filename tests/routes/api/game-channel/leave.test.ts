import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'

describe('Game channel API - leave', () => {
  it('should leave a channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)
  })

  it('should not leave a channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should leave a channel even if the player is not subscribed to it', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)
  })

  it('should delete a channel if auto cleanup is enabled the owner leaves', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game)
      .state(() => ({ autoCleanup: true }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    channel.members.add([
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
    ])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    const refreshedChannel = await em.refresh(channel)
    expect(refreshedChannel).toBeNull()
  })

  it('should delete a channel if auto cleanup is enabled the last player leaves', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game)
      .state(() => ({ autoCleanup: true }))
      .one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .post(`/v1/game-channels/${channel.id}/leave`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(204)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-left')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.deleted')
        expect(actual.data.channel.id).toBe(channel.id)
      })
    })

    const refreshedChannel = await em.refresh(channel)
    expect(refreshedChannel).toBeNull()
  })

  it('should not delete a channel if auto cleanup is not enabled and the owner leaves', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game)
      .state(() => ({ autoCleanup: false }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    channel.members.add([
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
    ])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    const refreshedChannel = await em.refreshOrFail(channel)
    expect(refreshedChannel.id).toBe(channel.id)
    expect(refreshedChannel.owner).toBe(null)
  })

  it('should not leave a channel with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found',
    })
  })

  it('should not leave a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post('/v1/game-channels/54252/leave')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found',
    })
  })

  it('should notify players in the channel when a player leaves', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS,
    ])

    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .post(`/v1/game-channels/${channel.id}/leave`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(204)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-left')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
    })
  })

  it('should allow leaving a channel with a null owner', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = null
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    const updatedChannel = await em.refreshOrFail(channel, { populate: ['members'] })
    expect(updatedChannel.members.count()).toBe(0)
  })
})
