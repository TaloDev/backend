import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import GameChannelStoragePropFactory from '../../../fixtures/GameChannelStoragePropFactory'
import GameChannelStorageProp from '../../../../src/entities/game-channel-storage-prop'
import { randText } from '@ngneat/falso'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'
import redisConfig from '../../../../src/config/redis.config'
import Redis from 'ioredis'

describe('Game channel API service - putStorage', () => {
  it('should create new storage props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: '100' },
          { key: 'level', value: '5' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.upsertedProps).toHaveLength(2)
    expect(res.body.deletedProps).toHaveLength(0)
    expect(res.body.failedProps).toHaveLength(0)

    const props = await em.getRepository(GameChannelStorageProp).findAll()
    expect(props).toHaveLength(2)

    const scoreProp = props.find((p) => p.key === 'score')
    expect(scoreProp).toBeDefined()
    expect(scoreProp!.value).toBe('100')
    expect(scoreProp!.createdBy.id).toBe(player.aliases[0].id)
    expect(scoreProp!.lastUpdatedBy.id).toBe(player.aliases[0].id)
  })

  it('should update existing storage props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])

    const existingProp = await new GameChannelStoragePropFactory(channel).state(() => ({
      key: 'score',
      value: '50',
      createdBy: player.aliases[0],
      lastUpdatedBy: player.aliases[0]
    })).one()

    await em.persistAndFlush([channel, existingProp])

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: '100' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.upsertedProps).toHaveLength(1)
    expect(res.body.deletedProps).toHaveLength(0)
    expect(res.body.failedProps).toHaveLength(0)

    await em.refresh(existingProp)
    expect(existingProp.value).toBe('100')
    expect(existingProp.lastUpdatedBy.id).toBe(player.aliases[0].id)
  })

  it('should delete props when value is null', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])

    const existingProp = await new GameChannelStoragePropFactory(channel).state(() => ({
      key: 'score',
      value: '50',
      createdBy: player.aliases[0],
      lastUpdatedBy: player.aliases[0]
    })).one()

    await em.persistAndFlush([channel, existingProp])

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: null }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.upsertedProps).toHaveLength(0)
    expect(res.body.deletedProps).toHaveLength(1)
    expect(res.body.failedProps).toHaveLength(0)

    const props = await em.getRepository(GameChannelStorageProp).find({
      key: 'score',
      gameChannel: channel
    })
    expect(props).toHaveLength(0)
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '100'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.failedProps).toHaveLength(1)
    expect(res.body.failedProps[0].error).toBe('Prop key length (129) exceeds 128 characters')
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          {
            key: 'description',
            value: randText({ charCount: 513 })
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.failedProps).toHaveLength(1)
    expect(res.body.failedProps[0].error).toBe('Prop value length (513) exceeds 512 characters')
  })

  it('should require props to be an array', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: {
          score: '100'
        }
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({ errors: { props: ['Props must be an array'] } })
  })

  it('should verify props are cached in Redis', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: '100' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const redis = new Redis(redisConfig)
    const cachedValue = await redis.get(GameChannelStorageProp.getRedisKey(channel.id, 'score'))
    const parsedValue = JSON.parse(cachedValue!)
    expect(parsedValue.value).toBe('100')
  })

  it('should require the player to be a member of the channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: '100' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not a member of the channel' })
  })

  it('should notify players in the channel when storage props are updated', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .put(`/v1/game-channels/${channel.id}/storage`)
        .send({
          props: [
            { key: 'score', value: '100' }
          ]
        })
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.storage.updated')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.upsertedProps).toHaveLength(1)
        expect(actual.data.deletedProps).toHaveLength(0)
      })
    })
  })

  it('should not update storage props if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await request(app)
      .put(`/v1/game-channels/${channel.id}/storage`)
      .send({
        props: [
          { key: 'score', value: '100' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })
})
