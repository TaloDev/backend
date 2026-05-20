import { randText } from '@ngneat/falso'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Game channel API - create', () => {
  it('should create a game channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({ name: 'Guild chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.name).toBe('Guild chat')
    expect(res.body.channel.owner.id).toBe(player.aliases[0].id)
    expect(res.body.channel.totalMessages).toBe(0)
    expect(res.body.channel.props).toStrictEqual([])
    expect(res.body.channel.memberCount).toBe(1)
    expect(res.body.channel.autoCleanup).toBe(false)
    expect(res.body.channel.private).toBe(false)
    expect(res.body.channel.temporaryMembership).toBe(false)
  })

  it('should not create a game channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    await request(app)
      .post('/v1/game-channels')
      .send({ name: 'Guild chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not create a game channel if the alias does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({ name: 'Guild chat' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '324')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should create a game channel with props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({
        name: 'Guild chat',
        props: [{ key: 'guildId', value: '213432' }],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.props).toStrictEqual([{ key: 'guildId', value: '213432' }])
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const longKey = randText({ charCount: 129 })
    const res = await request(app)
      .post('/v1/game-channels')
      .send({
        name: 'Guild chat',
        props: [
          {
            key: longKey,
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['One or more props are invalid, see rejectedProps'],
      },
      rejectedProps: [
        {
          key: longKey,
          error: 'PROP_KEY_TOO_LONG',
          message: 'Prop key length (129) exceeds 128 characters',
        },
      ],
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({
        name: 'Guild chat',
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 }),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['One or more props are invalid, see rejectedProps'],
      },
      rejectedProps: [
        {
          key: 'bio',
          error: 'PROP_VALUE_TOO_LONG',
          message: 'Prop value length (513) exceeds 512 characters',
        },
      ],
    })
  })

  it('should create a private game channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({ name: 'Guild chat', private: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.private).toBe(true)
  })

  it('should create a game channel with temporary membership', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/game-channels')
      .send({ name: 'Guild chat', temporaryMembership: true })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.temporaryMembership).toBe(true)
  })
})

it('should accept valid props when blockPropsProfanity is enabled', async () => {
  const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
  apiKey.game.blockPropsProfanity = true
  await em.flush()

  const player = await new PlayerFactory([apiKey.game]).one()
  await em.persist(player).flush()

  const res = await request(app)
    .post('/v1/game-channels')
    .send({
      name: 'Guild chat',
      props: [
        { key: 'guildId', value: '1234' },
        { key: 'level', value: '5' },
      ],
    })
    .auth(token, { type: 'bearer' })
    .set('x-talo-alias', String(player.aliases[0].id))
    .expect(200)

  expect(res.body.channel.props).toEqual(
    expect.arrayContaining([
      { key: 'guildId', value: '1234' },
      { key: 'level', value: '5' },
    ]),
  )
})

it('should reject profane props when blockPropsProfanity is enabled', async () => {
  const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
  apiKey.game.blockPropsProfanity = true
  await em.flush()

  const player = await new PlayerFactory([apiKey.game]).one()
  await em.persist(player).flush()

  const res = await request(app)
    .post('/v1/game-channels')
    .send({
      name: 'Guild chat',
      props: [
        { key: 'guildId', value: 'fuck' },
        { key: 'level', value: '5' },
      ],
    })
    .auth(token, { type: 'bearer' })
    .set('x-talo-alias', String(player.aliases[0].id))
    .expect(400)

  expect(res.body).toStrictEqual({
    errors: {
      props: ['One or more props are invalid, see rejectedProps'],
    },
    rejectedProps: [
      {
        key: 'guildId',
        error: 'PROP_CONTAINS_PROFANITY',
        message: 'Prop value contains profanity',
      },
    ],
  })
})

it('should allow profane props when blockPropsProfanity is disabled', async () => {
  const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

  const player = await new PlayerFactory([apiKey.game]).one()
  await em.persist(player).flush()

  const res = await request(app)
    .post('/v1/game-channels')
    .send({
      name: 'Guild chat',
      props: [
        { key: 'guildId', value: 'fuck' },
        { key: 'level', value: '5' },
      ],
    })
    .auth(token, { type: 'bearer' })
    .set('x-talo-alias', String(player.aliases[0].id))
    .expect(200)

  expect(res.body.channel.props).toEqual(
    expect.arrayContaining([
      { key: 'guildId', value: 'fuck' },
      { key: 'level', value: '5' },
    ]),
  )
})
