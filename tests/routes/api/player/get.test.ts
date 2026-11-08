import { randUuid } from '@ngneat/falso'
import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Player API - get', () => {
  it('should get a player by ID', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/v1/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
    expect(res.body.player.aliases).toHaveLength(player.aliases.length)
  })

  it('should not find a player if the scope is missing', async () => {
    const [, token] = await createAPIKeyAndToken([])

    await request(app).get('/v1/players/123').auth(token, { type: 'bearer' }).expect(403)
  })

  it('should not find a non-existent player', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])

    const res = await request(app)
      .get('/v1/players/non-existent-id')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not get a player without their claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/v1/players/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_CLAIM_KEY')
  })

  it('should get a player that has a claim key with a talo session', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]
    player.claimKey = randUuid()
    await em.persist(player).flush()

    assert(player.auth)
    const { sessionToken } = await player.auth.createSession(alias)
    await em.flush()

    // a validated session is at least as strong as the key, so it counts here too
    await request(app)
      .get(`/v1/players/${player.id}`)
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should get a player with their claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = 'the-claim-key'
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/v1/players/${player.id}`)
      .set('x-talo-claim-key', 'the-claim-key')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player.id)
  })
})
