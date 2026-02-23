import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key'
import PlayerFactory from '../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'

describe('Policy base class', () => {
  it('should reject a revoked api key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    apiKey.revokedAt = new Date()
    await em.flush()

    await request(app)
      .get('/v1/players/identify?service=username&identifier=')
      .query({ service: 'username', identifier: 'ionproject' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should correctly verify having a scope when the key has full access', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.FULL_ACCESS])
    await request(app).get('/v1/game-config').auth(token, { type: 'bearer' }).expect(200)
  })

  it('should correctly verify having all scopes when the key has full access', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.FULL_ACCESS])

    const player1 = await new PlayerFactory([apiKey.game]).withGuestAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist([player1, player2]).flush()

    await request(app)
      .post('/v1/players/merge')
      .set('x-talo-alias', String(player1.aliases[0].id))
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should show all missing scopes if using hasScopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player1 = await new PlayerFactory([apiKey.game]).withGuestAlias().one()
    const player2 = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist([player1, player2]).flush()

    const res = await request(app)
      .post('/v1/players/merge')
      .set('x-talo-alias', String(player1.aliases[0].id))
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Missing access key scope(s): read:players, write:players',
    })
  })
})
