import { Collection } from '@mikro-orm/mysql'
import { randNumber } from '@ngneat/falso'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { IntegrationType } from '../../../../src/entities/integration'
import PlayerAlias, { PlayerAliasService } from '../../../../src/entities/player-alias'
import PlayerAuth from '../../../../src/entities/player-auth'
import PlayerAuthActivity, {
  PlayerAuthActivityType,
} from '../../../../src/entities/player-auth-activity'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player auth API - migrate', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(async () => {
    axiosMock.reset()
  })

  it('should migrate a talo alias to another service', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({ identifier: 'boz' }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/migrate')
      .send({ currentPassword: 'password', service: 'custom', identifier: 'my-custom-id' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(200)

    expect(res.body.alias.service).toBe('custom')
    expect(res.body.alias.identifier).toBe('my-custom-id')

    const updatedAuth = await em.repo(PlayerAuth).findOne({ player: player.id })
    expect(updatedAuth).toBeNull()

    const activity = await em.repo(PlayerAuthActivity).findOne({
      type: PlayerAuthActivityType.MIGRATED_AUTH,
      player: player.id,
      extra: {
        oldIdentifier: 'boz',
        newService: 'custom',
      },
    })
    expect(activity).not.toBeNull()
  })

  it('should not migrate if the api key does not have the correct scopes', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player).talo().one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    await request(app)
      .post('/v1/players/auth/migrate')
      .send({ currentPassword: 'password', service: 'custom', identifier: 'my-custom-id' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)
  })

  it('should not migrate if the current password is incorrect', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({ identifier: 'boz' }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/migrate')
      .send({ currentPassword: 'wrong-password', service: 'custom', identifier: 'my-custom-id' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'Current password is incorrect',
      errorCode: 'INVALID_CREDENTIALS',
    })
  })

  it('should not migrate to the talo service', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({ identifier: 'boz' }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist(player).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/migrate')
      .send({ currentPassword: 'password', service: 'talo', identifier: 'boz2' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Cannot migrate to the Talo service',
      errorCode: 'INVALID_MIGRATION_TARGET',
    })
  })

  it('should not migrate if the identifier already exists for another player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const otherPlayer = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .state(() => ({ service: 'custom', identifier: 'taken-id' }))
          .one()

        return { aliases: new Collection<PlayerAlias>(player, [alias]) }
      })
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({ identifier: 'boz' }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist([otherPlayer, player]).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/migrate')
      .send({ currentPassword: 'password', service: 'custom', identifier: 'taken-id' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(409)

    expect(res.body).toStrictEqual({
      message: 'A player already exists with this identifier',
      errorCode: 'IDENTIFIER_TAKEN',
    })
  })

  it('should migrate a talo alias to a steamworks alias', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'
    const identity = 'talo'

    const authenticateTicketMock = vi.fn(() => [
      200,
      {
        response: {
          params: {
            steamid: steamId,
            ownersteamid: steamId,
            vacbanned: false,
            publisherbanned: false,
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}&identity=${identity}`,
      )
      .reply(authenticateTicketMock)

    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(() => [
        200,
        {
          appownership: {
            appid: appId,
            ownsapp: true,
            permanent: true,
            timestamp: '2021-08-01T00:00:00.000Z',
            ownersteamid: steamId,
            usercanceled: false,
          },
        },
      ])

    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(() => [
        200,
        {
          response: {
            players: [{ steamid: steamId, personaname: 'TestPlayer', avatarhash: 'abcd1234' }],
          },
        },
      ])

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()

    const player = await new PlayerFactory([apiKey.game])
      .state(async (player) => {
        const alias = await new PlayerAliasFactory(player)
          .talo()
          .state(() => ({ identifier: 'boz' }))
          .one()

        return {
          aliases: new Collection<PlayerAlias>(player, [alias]),
          auth: await new PlayerAuthFactory()
            .state(async () => ({ password: await bcrypt.hash('password', 10) }))
            .one(),
        }
      })
      .one()

    const alias = player.aliases[0]
    await em.persist([integration, player]).flush()

    const { sessionToken } = await player.auth!.createSession(alias)
    await em.flush()

    const res = await request(app)
      .post('/v1/players/auth/migrate')
      .send({
        currentPassword: 'password',
        service: PlayerAliasService.STEAM,
        identifier: `${identity}:${ticket}`,
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-player', player.id)
      .set('x-talo-alias', String(alias.id))
      .set('x-talo-session', sessionToken)
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(res.body.alias.service).toBe(PlayerAliasService.STEAM)
    expect(res.body.alias.identifier).toBe(steamId)

    const updatedAuth = await em.repo(PlayerAuth).findOne({ player: player.id })
    expect(updatedAuth).toBeNull()
  })
})
