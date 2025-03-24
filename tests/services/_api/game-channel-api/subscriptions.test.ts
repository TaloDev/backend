import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'

describe('Game channel API service - subscriptions', () => {
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
      message: 'Player not found'
    })
  })
})
