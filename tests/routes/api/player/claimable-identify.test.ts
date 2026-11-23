import { randUuid } from '@ngneat/falso'
import assert from 'node:assert'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerAlias from '../../../../src/entities/player-alias.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'

describe('Player API - claimable identify', () => {
  it('should create a player without a claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const res = await request(app)
      .post('/v1/players/identify')
      .send({ service: 'username', identifier: 'jimbo' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe('jimbo')

    const alias = await em.repo(PlayerAlias).findOneOrFail({
      service: 'username',
      identifier: 'jimbo',
      player: { game: apiKey.game },
    })
    expect(alias.player.claimKey).toBeNull()
  })

  it('should not identify without the read scope', async () => {
    const claimKey = randUuid()
    const [, token] = await createAPIKeyAndToken([])

    await request(app)
      .post('/v1/players/identify')
      .set('x-talo-claim-key', claimKey)
      .send({ service: 'username', identifier: 'jimbo' })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should store the claim key on a newly created player', async () => {
    const claimKey = randUuid()
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const res = await request(app)
      .post('/v1/players/identify')
      .set('x-talo-claim-key', claimKey)
      .send({ service: 'username', identifier: 'jimbo' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe('jimbo')
    expect(res.body.alias.player).not.toHaveProperty('claimKey')

    const alias = await em.repo(PlayerAlias).findOneOrFail({
      service: 'username',
      identifier: 'jimbo',
      player: { game: apiKey.game },
    })
    expect(alias.player.claimKey).toBe(claimKey)
  })

  it('should identify a player with their claim key', async () => {
    const claimKey = randUuid()
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = claimKey
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/identify')
      .set('x-talo-claim-key', claimKey)
      .send({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.player.id).toBe(player.id)
  })

  it('should not identify a player with a different claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    player.claimKey = randUuid()
    await em.persist(player).flush()

    const res = await request(app)
      .post('/v1/players/identify')
      .set('x-talo-claim-key', 'not-the-right-key')
      .send({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body.errorCode).toBe('INVALID_CLAIM_KEY')
  })

  it('should not allow an existing player without a claim key to be seized', async () => {
    const claimKey = randUuid()
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist(player).flush()

    await request(app)
      .post('/v1/players/identify')
      .set('x-talo-claim-key', claimKey)
      .send({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player)
    expect(player.claimKey).toBeNull()
  })

  it('should identify an existing player without a claim key', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withUsernameAlias().one()
    await em.persist(player).flush()

    // the alias was created without a claim key, so one isn't required
    await request(app)
      .post('/v1/players/identify')
      .send({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not require a claim key for a talo player', async () => {
    const claimKey = randUuid()
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persist(player).flush()

    assert(player.auth)
    const { sessionToken } = await player.auth.createSession(player.aliases[0])
    await em.flush()

    await request(app)
      .post('/v1/players/identify')
      .send({ service: player.aliases[0].service, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .set('x-talo-session', sessionToken)
      .set('x-talo-claim-key', claimKey)
      .expect(200)

    await em.refresh(player)
    expect(player.claimKey).toBeNull()
  })
})
