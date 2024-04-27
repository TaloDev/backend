import { EntityManager } from '@mikro-orm/mysql'
import { APIKeyScope } from '../../src/entities/api-key'
import UserFactory from '../fixtures/UserFactory'
import request from 'supertest'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'
import PlayerFactory from '../fixtures/PlayerFactory'

describe('Policy base class', () => {
  it('should reject a revoked api key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_EVENTS])
    apiKey.revokedAt = new Date()
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .get('/v1/players/identify?service=username&identifier=')
      .query({ service: 'username', identifier: 'ionproject' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should reject a non-existent user', async () => {
    const [organisation, game] = await createOrganisationAndGame()

    const user = await new UserFactory().with(() => ({ organisation })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    const token = await genAccessToken(user)
    await (<EntityManager>global.em).removeAndFlush(user)

    await request(global.app)
      .get(`/games/${game.id}/events`)
      .query({ startDate: '2021-01-01', endDate: '2021-01-02' })
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should correctly verify having a scope when the key has full access', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.FULL_ACCESS])
    await request(global.app)
      .get('/v1/game-config')
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should correctly verify having all scopes when the key has full access', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.FULL_ACCESS])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should show all missing scopes if using hasScopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player1 = await new PlayerFactory([apiKey.game]).one()
    const player2 = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player1, player2])

    const res = await request(global.app)
      .post('/v1/players/merge')
      .send({ playerId1: player1.id, playerId2: player2.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players, write:players' })
  })
})
