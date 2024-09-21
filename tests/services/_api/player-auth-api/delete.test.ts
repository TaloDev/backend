import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import PlayerAlias from '../../../../src/entities/player-alias'

describe('Player auth API service - delete', () => {
  it('should delete the account if the current password is correct', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    const prevIdentifier = alias.identifier

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)


    expect(await (<EntityManager>global.em).refresh(player.auth)).toBeNull()

    await (<EntityManager>global.em).refresh(player, { populate: ['aliases'] })
    expect(player.aliases).toHaveLength(0) // anonymous filter

    const anonymisedAlias = await (<EntityManager>global.em).getRepository(PlayerAlias).findOne(alias.id, {
      filters: {
        notAnonymised: false
      },
      refresh: true
    })
    expect(anonymisedAlias.identifier.startsWith('anonymised+')).toBe(true)
    expect(anonymisedAlias.anonymised).toBe(true)

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.DELETED_AUTH,
      player: player.id,
      extra: {
        identifier: prevIdentifier
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should not delete the account if the current password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    const res = await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'wrongpassword' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS'
    })

    await (<EntityManager>global.em).refresh(player.auth)
    expect(player.auth).not.toBeUndefined()

    const activity = await (<EntityManager>global.em).getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.DELETE_AUTH_FAILED,
      player: player.id
    })
    expect(activity).not.toBeNull()
  })

  it('should not delete the account if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await (<EntityManager>global.em).persistAndFlush(player)

    const sessionToken = await player.auth.createSession(alias)
    await (<EntityManager>global.em).flush()

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })
})
