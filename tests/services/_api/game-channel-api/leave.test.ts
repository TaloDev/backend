import request from 'supertest'
import requestWs from 'superwstest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameChannel from '../../../../src/entities/game-channel'
import Socket from '../../../../src/socket'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'

describe('Game channel API service - leave', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
    global.ctx.wss = socket
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should leave a channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
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
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)
  })

  it('should delete a channel if auto cleanup is enabled the owner leaves', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({ autoCleanup: true })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    channel.members.add([
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
      (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    ])
    await em.persistAndFlush(channel)

    await request(global.app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    em.clear()
    expect(await em.getRepository(GameChannel).findOne(channel.id)).toBeNull()
  })

  it('should delete a channel if auto cleanup is enabled the last player leaves', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({ autoCleanup: true })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(global.app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    em.clear()
    expect(await em.getRepository(GameChannel).findOne(channel.id)).toBeNull()
  })

  it('should not delete a channel if auto cleanup is not enabled and the owner leaves', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({ autoCleanup: false })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    channel.members.add([
      (await new PlayerFactory([apiKey.game]).one()).aliases[0],
      (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    ])
    await em.persistAndFlush(channel)

    await request(global.app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    em.clear()
    const refreshedChannel = await em.getRepository(GameChannel).findOne(channel.id)
    expect(refreshedChannel.id).toBe(channel.id)
    expect(refreshedChannel.owner).toBe(null)
  })

  it('should not leave a channel with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .post(`/v1/game-channels/${channel.id}/leave`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should not leave a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .post('/v1/game-channels/54252/leave')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should notify players in the channel when a player leaves', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await requestWs(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .exec(async () => {
        await request(global.app)
          .post(`/v1/game-channels/${channel.id}/leave`)
          .auth(token, { type: 'bearer' })
          .set('x-talo-alias', String(player.aliases[0].id))
          .expect(204)
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-left')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(player.aliases[0].id)
      })
  })
})
