import { randUuid } from '@ngneat/falso'
import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('Player alias middleware', () => {
  it('should allow an alias whose player has no claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist(player).flush()

    await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should reject an alias whose player has a claim key when the header is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    const res = await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({
      message: 'The x-talo-claim-key header is missing or invalid',
      errorCode: 'INVALID_CLAIM_KEY',
    })
  })

  it('should reject an alias whose player has a claim key when the header does not match', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-claim-key', randUuid())
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('should allow an alias with the claim key of its player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_STATS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    const claimKey = randUuid()
    player.claimKey = claimKey
    await em.persist(player).flush()

    await request(app)
      .get('/v1/game-stats/player-stats')
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-claim-key', claimKey)
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
