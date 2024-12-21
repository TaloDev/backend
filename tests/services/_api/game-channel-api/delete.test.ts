import request from 'supertest'
import requestWs from 'superwstest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameChannel from '../../../../src/entities/game-channel'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'
import Socket from '../../../../src/socket'

describe('Game channel API service - delete', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
    global.ctx.wss = socket
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should delete a channel if the scope is valid', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(global.app)
      .delete(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(204)

    em.clear()
    expect(await em.getRepository(GameChannel).findOne(channel.id)).toBeNull()
  })

  it('should not delete a channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
      .delete(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not delete a channel if it does not have an owner', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({ owner: null })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .delete(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should not delete a channel if the current alias is not the owner', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .delete(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should not delete a channel with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .delete(`/v1/game-channels/${channel.id}`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should not delete a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .delete('/v1/game-channels/54252')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should notify players in the channel when the channel is deleted', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const em: EntityManager = global.em

    const channel = await new GameChannelFactory(player.game).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    await em.persistAndFlush(channel)

    await requestWs(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson()
      .sendJson(identifyMessage)
      .expectJson()
      .exec(async () => {
        await request(global.app)
          .delete(`/v1/game-channels/${channel.id}`)
          .auth(token, { type: 'bearer' })
          .set('x-talo-alias', String(player.aliases[0].id))
          .expect(204)
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.deleted')
        expect(actual.data.channel.id).toBe(channel.id)
      })
  })
})
