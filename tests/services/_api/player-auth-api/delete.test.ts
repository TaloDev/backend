import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { EntityManager } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import PlayerAlias from '../../../../src/entities/player-alias'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerPresenceFactory from '../../../fixtures/PlayerPresenceFactory'

describe('Player auth API service - delete', () => {
  it('should delete the account if the current password is correct', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const em: EntityManager = global.em

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const prevIdentifier = alias.identifier

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    em.clear()

    const updatedPlayer = await em.refreshOrFail(player, { populate: ['aliases', 'auth'] })
    expect(updatedPlayer.aliases).toHaveLength(0)
    expect(updatedPlayer.auth).toBeNull()

    expect(await em.getRepository(PlayerAlias).findOne(alias.id)).toBeNull()

    const activity = await global.em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.DELETED_AUTH,
      player: player.id,
      extra: {
        identifier: prevIdentifier
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should delete events associated with the player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const em: EntityManager = global.em

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const events = await new EventFactory([player]).many(3)
    await global.clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await vi.waitUntil(async () => {
      const count = await global.clickhouse.query({
        query: `SELECT count() as count FROM events WHERE player_alias_id = ${alias.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return count === 0
    })

    const updatedEventPropsCount = await global.clickhouse.query({
      query: 'SELECT count() as count FROM event_props',
      format: 'JSONEachRow'
    }).then((res) => res.json<{ count: string }>())
      .then((res) => Number(res[0].count))

    expect(updatedEventPropsCount).toBe(0)
  })

  it('should not delete the account if the current password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await global.em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await global.em.flush()

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

    await global.em.refresh(player.auth!)
    expect(player.auth).not.toBeUndefined()

    const activity = await global.em.getRepository(PlayerAuthActivity).findOne({
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
    await global.em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await global.em.flush()

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should delete the account when the player has presence attached to the current alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()

    const alias = player.aliases[0]

    const presence = await new PlayerPresenceFactory(apiKey.game).state(async () => ({
      playerAlias: alias
    })).one()

    player.presence = presence
    await global.em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await global.em.flush()

    await request(global.app)
      .delete('/v1/players/auth/')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)
  })
})
