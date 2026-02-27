import { Collection } from '@mikro-orm/mysql'
import { randNumber } from '@ngneat/falso'
import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { IntegrationType } from '../../../../src/entities/integration'
import { PlayerAliasService } from '../../../../src/entities/player-alias'
import PlayerProp from '../../../../src/entities/player-prop'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Player API - steamworks identify', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(async () => {
    axiosMock.reset()
  })

  it('should identify a steamworks player', async () => {
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

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [
      200,
      {
        response: {
          players: [
            {
              steamid: steamId,
              personaname: 'TestPlayer',
              avatarhash: 'abcd1234',
            },
          ],
        },
      },
    ])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game])
      .withSteamAlias(steamId)
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'META_STEAMWORKS_OWNS_APP_PERMANENTLY', 'false'),
        ]),
      }))
      .one()

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist([integration, player]).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: `${identity}:${ticket}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    expect(res.body.alias.player.id).toBe(player.id)
    expect(res.body.alias.player.props).toEqual(
      expect.arrayContaining([
        {
          key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
          value: 'true',
        },
        {
          key: 'META_STEAMWORKS_VAC_BANNED',
          value: 'false',
        },
        {
          key: 'META_STEAMWORKS_PUBLISHER_BANNED',
          value: 'false',
        },
        {
          key: 'META_STEAMWORKS_OWNS_APP',
          value: 'true',
        },
        {
          key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
          value: '2021-08-01T00:00:00.000Z',
        },
        {
          key: 'META_STEAMWORKS_PERSONA_NAME',
          value: 'TestPlayer',
        },
        {
          key: 'META_STEAMWORKS_AVATAR_HASH',
          value: 'abcd1234',
        },
      ]),
    )
  })

  it('should identify a non-existent steamworks player by creating a new player with the write scope', async () => {
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

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [
      200,
      {
        response: {
          players: [
            {
              steamid: steamId,
              personaname: 'NewPlayer',
              avatarhash: 'xyz789',
            },
          ],
        },
      },
    ])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: `${identity}:${ticket}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z',
      },
      {
        key: 'META_STEAMWORKS_PERSONA_NAME',
        value: 'NewPlayer',
      },
      {
        key: 'META_STEAMWORKS_AVATAR_HASH',
        value: 'xyz789',
      },
    ])
  })

  it('should identify without a ticket identity', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias.identifier).toBe(steamId)
  })

  it('should catch ticket validation errors', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [
      200,
      {
        response: {
          error: {
            errorcode: 101,
            errordesc: 'Invalid ticket',
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(0)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Invalid ticket (101)',
    })
  })

  it('should catch bad request errors from Steam', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [
      200,
      {
        response: {
          error: {
            errorcode: 100,
            errordesc: 'User is offline',
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: User is offline (100)',
    })
  })

  it('should catch forbidden authenticate ticket requests', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [403, {}])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Invalid API key',
    })
  })

  it('should catch forbidden verify ownership requests', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [403])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to verify Steamworks ownership: Invalid API key',
    })
  })

  it('should catch malformed authenticate ticket responses', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [
      200,
      {
        response: {
          // no params
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Invalid response from Steamworks',
    })
  })

  it('should handle non-200 player summary responses gracefully', async () => {
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

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [500, {}])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: `${identity}:${ticket}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    // should not include persona name or avatar hash props
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z',
      },
    ])
  })

  it('should handle malformed player summary responses gracefully', async () => {
    // this test exists just in case of some undocumented Steamworks API behaviour

    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [
      200,
      {
        response: {
          // no players array
        },
      },
    ])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    // should not include persona name or avatar hash props
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z',
      },
    ])
  })

  it('should handle the identified player not being in the summary response gracefully', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [
      200,
      {
        response: {
          params: {
            steamid: steamId,
            ownersteamid: steamId,
            vacbanned: true,
            publisherbanned: false,
          },
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
      200,
      {
        appownership: {
          appid: appId,
          ownsapp: true,
          permanent: false,
          timestamp: '2022-01-15T00:00:00.000Z',
          ownersteamid: steamId,
          usercanceled: false,
        },
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [
      200,
      {
        response: {
          players: [
            {
              steamid: 'different-steam-id',
              personaname: 'DifferentPlayer',
              avatarhash: 'different-hash',
            },
          ],
        },
      },
    ])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    // should not include persona name or avatar hash props since player wasn't found
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2022-01-15T00:00:00.000Z',
      },
    ])
  })

  it('should handle 5xx errors from the authenticate ticket endpoint', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [500, {}])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Steam service unavailable',
    })
  })

  it('should handle 5xx errors from the verify ownership endpoint', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [500, {}])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to verify Steamworks ownership: Steam service unavailable',
    })
  })

  it('should handle malformed verify ownership responses', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
      200,
      {
        // missing appownership field
      },
    ])
    axiosMock
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to verify Steamworks ownership: Invalid response from Steamworks',
    })
  })

  it('should handle 5xx errors from the player summary endpoint gracefully', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [500, {}])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    // should not include persona name or avatar hash props since player summary failed
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true',
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z',
      },
    ])
  })

  it('should update existing persona name and avatar hash props on re-identification', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

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
        `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`,
      )
      .reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [
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
      .onGet(
        `https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`,
      )
      .reply(verifyOwnershipMock)

    const playerSummaryMock = vi.fn(() => [
      200,
      {
        response: {
          players: [
            {
              steamid: steamId,
              personaname: 'UpdatedPlayerName',
              avatarhash: 'newhash456',
            },
          ],
        },
      },
    ])
    axiosMock
      .onGet(`https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2?steamids=${steamId}`)
      .reply(playerSummaryMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game])
      .withSteamAlias(steamId)
      .state((player) => ({
        props: new Collection<PlayerProp>(player, [
          new PlayerProp(player, 'META_STEAMWORKS_PERSONA_NAME', 'OldPlayerName'),
          new PlayerProp(player, 'META_STEAMWORKS_AVATAR_HASH', 'oldhash123'),
        ]),
      }))
      .one()

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persist([integration, player]).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledOnce()
    expect(verifyOwnershipMock).toHaveBeenCalledOnce()
    expect(playerSummaryMock).toHaveBeenCalledOnce()

    expect(res.body.alias.identifier).toBe(steamId)
    expect(res.body.alias.player.id).toBe(player.id)

    // check that persona name and avatar hash are updated
    const personaProp = res.body.alias.player.props.find(
      (p: { key: string }) => p.key === 'META_STEAMWORKS_PERSONA_NAME',
    )
    const avatarProp = res.body.alias.player.props.find(
      (p: { key: string }) => p.key === 'META_STEAMWORKS_AVATAR_HASH',
    )

    expect(personaProp?.value).toBe('UpdatedPlayerName')
    expect(avatarProp?.value).toBe('newhash456')
  })
})
