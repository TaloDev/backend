import { Collection } from '@mikro-orm/mysql'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerAlias from '../../../../src/entities/player-alias'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player auth API - change identifier', () => {
  it("should change a player's identifier if the current password is correct and the api key has the correct scopes", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'boz',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({
              password: await bcrypt.hash('password', 10),
            }))
            .one(),
        }
      })
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password', newIdentifier: 'bozza' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(200)

    expect(res.body.alias.identifier).toBe('bozza')

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGED_IDENTIFIER,
      player: player.id,
      extra: {
        oldIdentifier: 'boz',
      },
    })
    expect(activity).not.toBeNull()
  })

  it("should not change a player's identifier if the api key does not have the correct scopes", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'boz',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({
              password: await bcrypt.hash('password', 10),
            }))
            .one(),
        }
      })
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password', newIdentifier: 'bozza' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it("should not change a player's identifier if the current password is incorrect", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'boz',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({
              password: await bcrypt.hash('password', 10),
            }))
            .one(),
        }
      })
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password1', newIdentifier: 'bozza' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
      player: player.id,
      extra: {
        errorCode: 'INVALID_CREDENTIALS',
      },
    })
    expect(activity).not.toBeNull()
  })

  it("should not change a player's identifier if the current identifier is the same as the new identifier", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'boz',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({
              password: await bcrypt.hash('password', 10),
            }))
            .one(),
        }
      })
      .one()
    const alias = player.aliases[0]
    await em.persist(player).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password', newIdentifier: 'boz' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Please choose a different identifier',
      errorCode: 'NEW_IDENTIFIER_MATCHES_CURRENT_IDENTIFIER',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
      player: player.id,
      extra: {
        errorCode: 'NEW_IDENTIFIER_MATCHES_CURRENT_IDENTIFIER',
      },
    })
    expect(activity).not.toBeNull()
  })

  it("should not change a player's identifier if the new identifier is taken", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const otherPlayer = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'bozza',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory().one(),
        }
      })
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({
            identifier: 'boz',
          }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({
              password: await bcrypt.hash('password', 10),
            }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist([otherPlayer, player]).flush()

    const sessionToken = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password', newIdentifier: 'bozza' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'This identifier is already taken',
      errorCode: 'IDENTIFIER_TAKEN',
    })

    const activity = await em.getRepository(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED,
      player: player.id,
      extra: {
        errorCode: 'IDENTIFIER_TAKEN',
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should return a 400 if the player does not have authentication', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist(player).flush()

    const alias = player.aliases[0]

    const res = await request(app)
      .post('/v1/players/auth/change_identifier')
      .send({ currentPassword: 'password', newIdentifier: 'newidentifier' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', 'fake-session')
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Player does not have authentication' })
  })
})
