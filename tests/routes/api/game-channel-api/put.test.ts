import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'
import { randText } from '@ngneat/falso'
import { Collection } from '@mikro-orm/mysql'
import GameChannelProp from '../../../../src/entities/game-channel-prop'

describe('Game channel API - put', () => {
  it('should update a channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
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
    await em.persistAndFlush(channel)

    await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not update a channel if it does not have an owner', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should not update a channel if the current alias is not the owner', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = (await new PlayerFactory([apiKey.game]).one()).aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ name: 'A very interesting chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not the owner of the channel' })
  })

  it('should update the props of a channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state((channel) => ({
      name: 'Guild chat',
      props: new Collection<GameChannelProp>(channel, [
        new GameChannelProp(channel, 'guildId', '1234'),
        new GameChannelProp(channel, 'deleteMe', 'yes')
      ])
    })).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
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
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).state((channel) => ({
      name: 'Guild chat',
      props: new Collection<GameChannelProp>(channel, [
        new GameChannelProp(channel, 'guildId', '1234')
      ])
    })).one()

    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])

    await em.persistAndFlush(channel)

    const res = await request(app)
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
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    const newOwner = await new PlayerFactory([apiKey.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ ownerAliasId: newOwner.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.owner.id).toBe(newOwner.aliases[0].id)
  })

  it('should set the channel owner to null if ownerAliasId is null', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({ ownerAliasId: null })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.owner).toBeNull()
  })

  it('should not update the channel owner if the provided alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
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
    await em.persistAndFlush(channel)

    const res = await request(app)
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
    await em.persistAndFlush(channel)

    const res = await request(app)
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

    const channel = await new GameChannelFactory(player.game).one()
    const newOwner = await new PlayerFactory([player.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
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
      // only updating the owner shouldn't send the updated message
      await client.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.channels.updated')
      })
    })
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop key length (129) exceeds 128 characters']
      }
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}`)
      .send({
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 })
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (513) exceeds 512 characters']
      }
    })
  })

  it('should notify players in the channel when the channel is updated', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    const newOwner = await new PlayerFactory([player.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .put(`/v1/game-channels/${channel.id}`)
        .send({ name: 'New name' })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.updated')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.changedProperties[0]).toBe('name')
      })
    })
  })

  it('should not notify players in the channel if a channel attempt is made but nothing changes', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    const newOwner = await new PlayerFactory([player.game]).one()

    channel.owner = player.aliases[0]
    channel.members.add(player.aliases[0], newOwner.aliases[0])

    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .put(`/v1/game-channels/${channel.id}`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)
      await client.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.channels.updated')
      })
    })
  })
})
