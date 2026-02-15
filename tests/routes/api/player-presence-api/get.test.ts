import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerPresenceFactory from '../../../fixtures/PlayerPresenceFactory'

describe('Player Presence API - get', () => {
  it('should get a player presence', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_PRESENCE])
    const player = await new PlayerFactory([apiKey.game]).one()
    const presence = await new PlayerPresenceFactory(apiKey.game)
      .online()
      .withCustomStatus('Playing game')
      .one()
    player.presence = presence

    await em.persist(player).flush()

    const res = await request(app)
      .get(`/v1/players/presence/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.presence.online).toBe(true)
    expect(res.body.presence.customStatus).toBe('Playing game')
    expect(res.body.presence.playerAlias).toBeDefined()
  })

  it('should return the default presence when the player has no presence', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_PRESENCE])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .get(`/v1/players/presence/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.presence.online).toBe(false)
    expect(res.body.presence.customStatus).toBe('')
  })

  it('should not find presence if the scope is missing', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    await request(app)
      .get(`/v1/players/presence/${player.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not find presence for a non-existent player', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYER_PRESENCE])

    const res = await request(app)
      .get('/v1/players/presence/240fd578-0367-45d8-b0a3-f451f9d0a9a2')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
