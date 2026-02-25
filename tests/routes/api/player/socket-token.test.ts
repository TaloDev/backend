import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player API - socket token', () => {
  it('should create a socket token', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/socket-token')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.socketToken).toEqual(expect.any(String))
  })

  it('should not create a socket token if the scope is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    await request(app)
      .post('/v1/players/socket-token')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a socket token for a non-existent', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/socket-token')
      .set('x-talo-alias', '12345')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should require the x-talo-alias header to be set', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(app)
      .post('/v1/players/socket-token')
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        'x-talo-alias': ['x-talo-alias is missing from the request headers'],
      },
    })
  })

  it('should not create a socket token for a player from another game', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])
    const [apiKey2] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey2.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post('/v1/players/socket-token')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
