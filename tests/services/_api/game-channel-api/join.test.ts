import request from 'supertest'
import requestWs from 'superwstest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'
import Socket from '../../../../src/socket'

describe('Game channel API service - join', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
    global.ctx.wss = socket
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should join a channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([channel, player])

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush([channel, player])

    await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .post('/v1/game-channels/54252/join')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should notify players in the channel when a new player joins', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    await (<EntityManager>global.em).persistAndFlush([channel, player])

    await requestWs(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .exec(async () => {
        await request(global.app)
          .post(`/v1/game-channels/${channel.id}/join`)
          .auth(token, { type: 'bearer' })
          .set('x-talo-alias', String(player.aliases[0].id))
          .expect(200)
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-joined')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
  })
})
