import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import GameChannelProp from '../../../../src/entities/game-channel-prop'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game channel API - subscriptions', () => {
  it('should return a list of game channel subscriptions if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const subscribedChannel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    subscribedChannel.members.add(player.aliases[0])

    const notSubscribedChannels = await new GameChannelFactory(apiKey.game).many(5)
    await em.persistAndFlush([subscribedChannel, ...notSubscribedChannels, player])

    const res = await request(app)
      .get('/v1/game-channels/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channels.length).toBe(1)
    expect(res.body.channels[0].id).toBe(subscribedChannel.id)
  })

  it('should not return game channel subscriptions if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channels = await new GameChannelFactory(apiKey.game).many(10)
    const player = await new PlayerFactory([apiKey.game]).one()
    channels[0].members.add(player.aliases[0])
    await em.persistAndFlush([...channels, player])

    await request(app)
      .get('/v1/game-channels/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not return game channel subscriptions for an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get('/v1/game-channels/subscriptions')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found',
    })
  })

  it('should filter game channel subscriptions by prop keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game)
      .state((channel) => ({
        props: new Collection<GameChannelProp>(channel, [
          new GameChannelProp(channel, 'guildId', '15'),
        ]),
      }))
      .one()
    channel.members.add(player.aliases[0])

    const otherChannel = await new GameChannelFactory(apiKey.game).one()
    otherChannel.members.add(player.aliases[0])

    await em.persistAndFlush([channel, otherChannel, player])

    const res = await request(app)
      .get('/v1/game-channels/subscriptions')
      .query({ page: 0, propKey: 'guildId' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channels).toHaveLength(1)
    expect(res.body.channels[0].id).toBe(channel.id)
  })

  it('should filter game channel subscriptions by prop keys and values', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()

    const channel = await new GameChannelFactory(apiKey.game)
      .state((channel) => ({
        props: new Collection<GameChannelProp>(channel, [
          new GameChannelProp(channel, 'guildId', '15'),
        ]),
      }))
      .one()
    channel.members.add(player.aliases[0])

    const otherChannel = await new GameChannelFactory(apiKey.game)
      .state((channel) => ({
        props: new Collection<GameChannelProp>(channel, [
          new GameChannelProp(channel, 'guildId', '17'),
        ]),
      }))
      .one()
    otherChannel.members.add(player.aliases[0])

    const irrelevantChannel = await new GameChannelFactory(apiKey.game).one()
    irrelevantChannel.members.add(player.aliases[0])

    await em.persistAndFlush([channel, otherChannel, irrelevantChannel, player])

    const res = await request(app)
      .get('/v1/game-channels/subscriptions')
      .query({ page: 0, propKey: 'guildId', propValue: '15' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channels).toHaveLength(1)
    expect(res.body.channels[0].id).toBe(channel.id)
  })
})
