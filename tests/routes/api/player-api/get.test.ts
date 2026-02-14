import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player API  - get', () => {
  it('should get a player by ID', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .get(`/v1/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
    expect(res.body.player.aliases).toHaveLength(player.aliases.length)
  })

  it('should not find a player if the scope is missing', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .get('/v1/players/123')
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not find a non-existent player', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/v1/players/non-existent-id')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
