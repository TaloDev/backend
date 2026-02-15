import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import bcrypt from 'bcrypt'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../../../src/entities/player-auth-activity'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerPresenceFactory from '../../../fixtures/PlayerPresenceFactory'
import PlayerAuthActivityFactory from '../../../fixtures/PlayerAuthActivityFactory'
import assert from 'node:assert'
import * as deletePlayers from '../../../../src/tasks/deletePlayers'

describe('Player auth API - delete', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should delete the account if the current password is correct', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    const activities = await new PlayerAuthActivityFactory(player.game).state(() => ({ player })).many(10)
    await em.persistAndFlush([player, ...activities])

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const prevIdentifier = alias.identifier

    await request(app)
      .delete('/v1/players/auth')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    const updatedPlayer = await em.refreshOrFail(player, { populate: ['aliases', 'auth'] })
    expect(updatedPlayer.aliases).toHaveLength(0)
    expect(updatedPlayer.auth).toBeNull()

    expect(await em.refresh(alias)).toBeNull()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.DELETED_AUTH,
      player: player.id,
      extra: {
        identifier: prevIdentifier
      }
    })
    assert(activity)
    expect(activity.extra.ip).toBeUndefined()

    const activityCount = await em.getRepository(PlayerAuthActivity).count({
      player: player.id
    })
    expect(activityCount).toBe(1)
  })

  it('should delete events associated with the player alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const events = await new EventFactory([player]).many(3)
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    await request(app)
      .delete('/v1/players/auth')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)

    await vi.waitUntil(async () => {
      const updatedEventsCount = await clickhouse.query({
        query: `SELECT count() as count FROM events WHERE player_alias_id = ${alias.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedEventPropsCount = await clickhouse.query({
        query: `SELECT count() as count FROM event_props ep INNER JOIN events e ON e.id = ep.event_id WHERE e.player_alias_id = ${alias.id}`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      const updatedPlayerSessionsCount = await clickhouse.query({
        query: `SELECT count() as count FROM player_sessions WHERE player_id = '${player.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<{ count: string }>())
        .then((res) => Number(res[0].count))

      return updatedEventsCount === 0 &&
        updatedEventPropsCount === 0 &&
        updatedPlayerSessionsCount === 0
    })
  })

  it('should not delete the account if the current password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .delete('/v1/players/auth')
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

    await em.refresh(player.auth!)
    expect(player.auth).not.toBeUndefined()

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
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
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .delete('/v1/players/auth')
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
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .delete('/v1/players/auth')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(204)
  })

  it('should rollback if clickhouse fails', async () => {
    vi.spyOn(deletePlayers, 'deleteClickHousePlayerData').mockRejectedValue(new Error())
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().state(async () => ({
      auth: await new PlayerAuthFactory().state(async () => ({
        password: await bcrypt.hash('password', 10)
      })).one()
    })).one()
    const alias = player.aliases[0]
    await em.persistAndFlush(player)

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .delete('/v1/players/auth')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(500)

    expect(await em.refresh(alias)).not.toBeNull()
  })

  it('should return a 400 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush(player)

    const alias = player.aliases[0]

    const res = await request(app)
      .delete('/v1/players/auth')
      .send({ currentPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', 'fake-session')
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
