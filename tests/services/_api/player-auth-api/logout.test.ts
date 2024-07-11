import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'

describe('Player auth API service - logout', () => {
  it('should logout a player if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/v1/players/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth.sessionKey).toBeNull()
    expect(player.auth.sessionCreatedAt).toBeNull()
  })

  it('should not logout a player if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).state('with talo alias').one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .post('/v1/players/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })
})
