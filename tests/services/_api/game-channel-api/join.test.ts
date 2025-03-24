import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'

describe('Game channel API service - join', () => {
  it('should join a channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/join`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.id).toBe(channel.id)
    expect(res.body.channel.memberCount).toBe(1)
  })

  it('should not join a channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    await request(app)
      .post(`/v1/game-channels/${channel.id}/join`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should join a channel even if the player is already subscribed to it', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/join`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.id).toBe(channel.id)
    expect(res.body.channel.memberCount).toBe(1)
  })

  it('should not join a channel with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/join`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should not join a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post('/v1/game-channels/54252/join')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should notify players in the channel when a new player joins', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    await em.persistAndFlush([channel, player])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .post(`/v1/game-channels/${channel.id}/join`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-joined')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
    })
  })
})
