import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'

describe('Player auth API  - logout', () => {
  it('should logout a player if the api key has the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await em.refresh(player.auth!)
    expect(player.auth!.sessionKey).toBeNull()
    expect(player.auth!.sessionCreatedAt).toBeNull()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.LOGGED_OUT,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should not logout a player if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should return a 400 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]

    const res = await request(app)
      .post('/v1/players/auth/logout')
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', 'fake-session')
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
