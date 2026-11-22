import { randUuid } from '@ngneat/falso'
import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('Player middleware', () => {
  it('should allow a player without a claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist(player).flush()

    await request(app)
      .get('/v1/game-saves')
      .set('x-talo-player', player.id)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should reject a player with a claim key when the header is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    const res = await request(app)
      .get('/v1/game-saves')
      .set('x-talo-player', player.id)
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'The x-talo-claim-key header is missing or invalid',
      errorCode: 'INVALID_CLAIM_KEY',
    })
  })

  it('should reject a player with a claim key when the header does not match', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    await request(app)
      .get('/v1/game-saves')
      .set('x-talo-player', player.id)
      .set('x-talo-claim-key', randUuid())
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it("should not accept another player's claim key", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()

    const otherClaimKey = randUuid()
    const otherPlayer = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    otherPlayer.claimKey = otherClaimKey
    await em.persist([player, otherPlayer]).flush()

    await request(app)
      .get('/v1/game-saves')
      .set('x-talo-player', player.id)
      .set('x-talo-claim-key', otherClaimKey)
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should ensure the session token has precedence over the claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_SAVES])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const taloAlias = player.aliases[0]
    player.claimKey = randUuid()
    await em.persist(player).flush()

    assert(player.auth)
    const { sessionToken } = await player.auth.createSession(taloAlias)
    await em.flush()

    // the session proves the player, so the claim key header isn't needed
    await request(app)
      .get('/v1/game-saves')
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(taloAlias.id))
      .set('x-talo-session', sessionToken)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
