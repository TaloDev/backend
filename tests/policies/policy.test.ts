import { EntityManager } from '@mikro-orm/core'
import { APIKeyScope } from '../../src/entities/api-key'
import UserFactory from '../fixtures/UserFactory'
import request from 'supertest'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

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
})
