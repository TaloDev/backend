import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { IntegrationType } from '../../../../src/entities/integration'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import { PlayerAliasService } from '../../../../src/entities/player-alias'
import PlayerProp from '../../../../src/entities/player-prop'
import { randNumber } from '@ngneat/falso'

describe('Player API service - identify - steamworks auth', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(async () => {
    axiosMock.reset()
  })

  it('should identify a steamworks player', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'
    const identity = 'talo'

    const authenticateTicketMock = vi.fn(() => [200, {
      response: {
        params: {
          steamid: steamId,
          ownersteamid: steamId,
          vacbanned: false,
          publisherbanned: false
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}&identity=${identity}`).reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [200, {
      appownership: {
        appid: appId,
        ownsapp: true,
        permanent: true,
        timestamp: '2021-08-01T00:00:00.000Z',
        ownersteamid: steamId,
        usercanceled: false
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`).reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias(steamId).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'META_STEAMWORKS_OWNS_APP_PERMANENTLY', 'false')
      ])
    })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await em.persistAndFlush([integration, player])

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: `${identity}:${ticket}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(1)

    expect(res.body.alias.identifier).toBe(steamId)
    expect(res.body.alias.player.id).toBe(player.id)
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true'
      },
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false'
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false'
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true'
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z'
      }
    ])
  })

  it('should identify a non-existent steamworks player by creating a new player with the write scope', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'
    const identity = 'talo'

    const authenticateTicketMock = vi.fn(() => [200, {
      response: {
        params: {
          steamid: steamId,
          ownersteamid: steamId,
          vacbanned: false,
          publisherbanned: false
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}&identity=${identity}`).reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [200, {
      appownership: {
        appid: appId,
        ownsapp: true,
        permanent: true,
        timestamp: '2021-08-01T00:00:00.000Z',
        ownersteamid: steamId,
        usercanceled: false
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`).reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await em.persistAndFlush(integration)

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: `${identity}:${ticket}` })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(2) // check + create
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(2)

    expect(res.body.alias.identifier).toBe(steamId)
    expect(res.body.alias.player.props).toStrictEqual([
      {
        key: 'META_STEAMWORKS_VAC_BANNED',
        value: 'false'
      },
      {
        key: 'META_STEAMWORKS_PUBLISHER_BANNED',
        value: 'false'
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP',
        value: 'true'
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_PERMANENTLY',
        value: 'true'
      },
      {
        key: 'META_STEAMWORKS_OWNS_APP_FROM_DATE',
        value: '2021-08-01T00:00:00.000Z'
      }
    ])
  })

  it('should identify without a ticket identity', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const steamId = randNumber({ min: 100_000, max: 1_000_000 }).toString()
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [200, {
      response: {
        params: {
          steamid: steamId,
          ownersteamid: steamId,
          vacbanned: false,
          publisherbanned: false
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`).reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [200, {
      appownership: {
        appid: appId,
        ownsapp: true,
        permanent: true,
        timestamp: '2021-08-01T00:00:00.000Z',
        ownersteamid: steamId,
        usercanceled: false
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`).reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await em.persistAndFlush(integration)

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

    const authenticateTicketMock = vi.fn(() => [200, {
      response: {
        error: {
          errorcode: 101,
          errordesc: 'Invalid ticket'
        }
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`).reply(authenticateTicketMock)

    const verifyOwnershipMock = vi.fn(() => [200, {
      appownership: {
        appid: appId,
        ownsapp: true,
        permanent: true,
        timestamp: '2021-08-01T00:00:00.000Z',
        ownersteamid: steamId,
        usercanceled: false
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUser/CheckAppOwnership/v3?appid=${appId}&steamid=${steamId}`).reply(verifyOwnershipMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await em.persistAndFlush(integration)

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)
    expect(verifyOwnershipMock).toHaveBeenCalledTimes(0)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Invalid ticket (101)'
    })
  })

  it('should catch forbidden requests', async () => {
    const appId = randNumber({ min: 1000, max: 1_000_000 })
    const ticket = '000validticket'

    const authenticateTicketMock = vi.fn(() => [403, {}])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1?appid=${appId}&ticket=${ticket}`).reply(authenticateTicketMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])

    const config = await new IntegrationConfigFactory().state(() => ({ appId })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await em.persistAndFlush(integration)

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: PlayerAliasService.STEAM, identifier: ticket })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(authenticateTicketMock).toHaveBeenCalledTimes(1)

    expect(res.body).toStrictEqual({
      message: 'Failed to authenticate Steamworks ticket: Invalid API key'
    })
  })
})
