import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'

describe('Game channel API service - post', () => {
  it('should create a game channel if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

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
  })

  it('should not create a game channel if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

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
    await em.persistAndFlush(player)

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
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/game-channels')
      .send({
        name: 'Guild chat',
        props: [
          { key: 'guildId', value: '213432' }
        ]
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.channel.props).toStrictEqual([
      { key: 'guildId', value: '213432' }
    ])
  })
})
