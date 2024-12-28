import request from 'supertest'
import { EntityManager } from '@mikro-orm/mysql'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'

describe('Game channel API service - put', () => {
  it('should update a channel if the scope is valid', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.name).toBe('A very interesting chat')
  })

  it('should not update a channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not update a channel if it does not have an owner', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should not update a channel if the current alias is not the owner', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should update the props of a channel', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({
      name: 'Guild chat',
      props: [
        { key: 'guildId', value: '1234' },
        { key: 'deleteMe', value: 'yes' }
      ]
    })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({
        props: [
          { key: 'guildId', value: '4321' },
          { key: 'deleteMe', value: null }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.props).toStrictEqual([
      { key: 'guildId', value: '4321' }
    ])
  })

  it('should require props to be an array', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state(() => ({
      name: 'Guild chat',
      props: [
        { key: 'guildId', value: '1234' }
      ]
    })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({
        props: {
          guildId: '4321'
        }
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Props must be an array']
      }
    })
  })

  it('should update the channel owner', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    const newOwner = await new PlayerFactory([apiKey.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ ownerAliasId: newOwner.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.owner.id).toBe(newOwner.aliases[0].id)
  })

  it('should not update the channel owner if they are now in the channel', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    const newOwner = await new PlayerFactory([apiKey.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    await em.persistAndFlush([channel, newOwner])

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ ownerAliasId: newOwner.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'New owner is not a member of the channel' })
  })

  it('should not update the channel owner if the provided alias does not exist', async () => {
    const em: EntityManager = global.em

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ ownerAliasId: 3123124 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'New owner not found' })
  })

  it('should not update a channel with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should not update a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await (<EntityManager>global.em).persistAndFlush(channel)

    const res = await request(global.app)
      .put('/v1/game-channels/54252')
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should notify players in the channel when ownership is transferred', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const em: EntityManager = global.em

    const channel = await new GameChannelFactory(player.game).one()
    const newOwner = await new PlayerFactory([player.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(global.app)
        .put(`/v1/game-channels/${channel.id}`)
        .send({ ownerAliasId: newOwner.aliases[0].id })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.ownership-transferred')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.newOwner.id).toBe(newOwner.aliases[0].id)
      })
    })
  })
})
