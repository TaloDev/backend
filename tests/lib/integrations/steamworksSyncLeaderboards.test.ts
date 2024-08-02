import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../../../src/config/mikro-orm.config'
import { IntegrationType } from '../../../src/entities/integration'
import { GetLeaderboardEntriesResponse, GetLeaderboardsForGameResponse, syncSteamworksLeaderboards } from '../../../src/lib/integrations/steamworks-integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import Leaderboard, { LeaderboardSortMode } from '../../../src/entities/leaderboard'
import SteamworksLeaderboardMapping from '../../../src/entities/steamworks-leaderboard-mapping'
import LeaderboardEntry from '../../../src/entities/leaderboard-entry'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import casual from 'casual'
import PlayerFactory from '../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'

describe('Steamworks integration - sync leaderboards', () => {
  let em: EntityManager
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    const orm = await MikroORM.init(ormConfig)
    em = orm.em
  })

  afterAll(async () => {
    await em.getConnection().close()
  })

  it('should pull in leaderboards and entries from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const steamworksLeaderboardId = casual.integer(100000, 999999)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush(integration)

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: [
          {
            id: steamworksLeaderboardId,
            name: 'Quickest Win',
            entries: 0,
            sortmethod: 'Ascending',
            displaytype: 'Numeric',
            onlytrustedwrites: false,
            onlyfriendsreads: false
          }
        ]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const getEntriesMock = vi.fn((): [number, GetLeaderboardEntriesResponse] => [200, {
      leaderboardEntryInformation: {
        appID: 375290,
        leaderboardID: steamworksLeaderboardId,
        totalLeaderBoardEntryCount: 1,
        leaderboardEntries: [{
          steamID: '76561198053368114',
          score: 1030,
          rank: 1,
          ugcid: '-1'
        }]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1?appid=${integration.getConfig().appId}&leaderboardid=${steamworksLeaderboardId}&rangestart=0&rangeend=1.7976931348623157e%2B308&datarequest=RequestGlobal`).replyOnce(getEntriesMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
    expect(getEntriesMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: `https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`,
      body: '',
      method: 'GET'
    })

    const createdLeaderboard = await em.getRepository(Leaderboard).findOne({
      game: integration.game,
      internalName: 'Quickest Win',
      name: 'Quickest Win',
      sortMode: LeaderboardSortMode.ASC,
      unique: true
    })

    expect(createdLeaderboard).toBeTruthy()

    const mapping = await em.getRepository(SteamworksLeaderboardMapping).findOne({
      leaderboard: createdLeaderboard,
      steamworksLeaderboardId
    })

    expect(mapping).toBeTruthy()

    const entry = await em.getRepository(LeaderboardEntry).findOne({ score: 1030 })
    expect(entry).toBeTruthy()
  })

  it('should throw if the response leaderboards are not an array', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush(integration)

    const getLeaderboardsMock = vi.fn((): [number] => [404])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    try {
      await syncSteamworksLeaderboards(em, integration)
    } catch (err) {
      expect(err.message).toBe('Failed to retrieve leaderboards - is your App ID correct?')
    }

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
  })

  it('should update leaderboards with properties from steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ sortMode: LeaderboardSortMode.ASC })).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([leaderboard, mapping, integration])

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: [
          {
            id: mapping.steamworksLeaderboardId,
            name: 'Biggest Combo',
            entries: 0,
            sortmethod: 'Descending',
            displaytype: 'Numeric',
            onlytrustedwrites: false,
            onlyfriendsreads: false
          }
        ]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const getEntriesMock = vi.fn((): [number, GetLeaderboardEntriesResponse] => [200, {
      leaderboardEntryInformation: {
        appID: 375290,
        leaderboardID: mapping.steamworksLeaderboardId,
        totalLeaderBoardEntryCount: 0,
        leaderboardEntries: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1?appid=${integration.getConfig().appId}&leaderboardid=${mapping.steamworksLeaderboardId}&rangestart=0&rangeend=1.7976931348623157e%2B308&datarequest=RequestGlobal`).replyOnce(getEntriesMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
    expect(getEntriesMock).toHaveBeenCalledTimes(1)

    const updatedLeaderboard = await em.getRepository(Leaderboard).findOne({
      game: integration.game,
      internalName: 'Biggest Combo',
      name: 'Biggest Combo',
      sortMode: LeaderboardSortMode.DESC,
      unique: true
    })

    expect(updatedLeaderboard).toBeTruthy()
  })

  it('should create a leaderboard mapping if a leaderboard with the same internal name exists', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const steamworksLeaderboardId = casual.integer(100000, 999999)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([leaderboard, integration])

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: [
          {
            id: steamworksLeaderboardId,
            name: leaderboard.internalName,
            entries: 0,
            sortmethod: 'Descending',
            displaytype: 'Numeric',
            onlytrustedwrites: false,
            onlyfriendsreads: false
          }
        ]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const getEntriesMock = vi.fn((): [number, GetLeaderboardEntriesResponse] => [200, {
      leaderboardEntryInformation: {
        appID: 375290,
        leaderboardID: steamworksLeaderboardId,
        totalLeaderBoardEntryCount: 0,
        leaderboardEntries: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1?appid=${integration.getConfig().appId}&leaderboardid=${steamworksLeaderboardId}&rangestart=0&rangeend=1.7976931348623157e%2B308&datarequest=RequestGlobal`).replyOnce(getEntriesMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
    expect(getEntriesMock).toHaveBeenCalledTimes(1)

    const mapping = await em.getRepository(SteamworksLeaderboardMapping).findOne({
      leaderboard,
      steamworksLeaderboardId
    })

    expect(mapping).toBeTruthy()
  })

  it('should create leaderboards in steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ sortMode: LeaderboardSortMode.DESC })).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([leaderboard, integration])

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const createMock = vi.fn(() => [200, {
      result: {
        result: 1,
        leaderboard: {
          leaderBoardID: 432423,
          leaderboardName: 'highscores',
          onlyfriendsreads: false,
          onlytrustedwrites: true,
          leaderBoardEntries: 0,
          leaderBoardSortMethod: 'Descending',
          leaderBoardDisplayType: 'Numeric'
        }
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2').replyOnce(createMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration }, { orderBy: { id: 'DESC' } })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2',
      body: `appid=${config.appId}&name=${leaderboard.internalName}&sortmethod=Descending&displaytype=Numeric&createifnotfound=true&onlytrustedwrites=true&onlyfriendsreads=false`,
      method: 'POST'
    })
  })

  it('should push through entries from steamworks for existing steam player aliases', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const steamworksLeaderboardId = casual.integer(100000, 999999)

    const player = await new PlayerFactory([game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([player, integration])

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: [
          {
            id: steamworksLeaderboardId,
            name: 'Quickest Win',
            entries: 0,
            sortmethod: 'Ascending',
            displaytype: 'Numeric',
            onlytrustedwrites: false,
            onlyfriendsreads: false
          }
        ]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const getEntriesMock = vi.fn((): [number, GetLeaderboardEntriesResponse] => [200, {
      leaderboardEntryInformation: {
        appID: 375290,
        leaderboardID: steamworksLeaderboardId,
        totalLeaderBoardEntryCount: 1,
        leaderboardEntries: [{
          steamID: player.aliases[0].identifier,
          score: 239,
          rank: 21,
          ugcid: '-1'
        }]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1?appid=${integration.getConfig().appId}&leaderboardid=${steamworksLeaderboardId}&rangestart=0&rangeend=1.7976931348623157e%2B308&datarequest=RequestGlobal`).replyOnce(getEntriesMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
    expect(getEntriesMock).toHaveBeenCalledTimes(1)

    const entry = await em.getRepository(LeaderboardEntry).findOne({ playerAlias: player.aliases[0] })
    expect(entry).toBeTruthy()
  })

  it('should push through entries from talo into steamworks', async () => {
    const [, game] = await createOrganisationAndGame(em)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([leaderboard, mapping, player, entry, integration])

    const getLeaderboardsMock = vi.fn((): [number, GetLeaderboardsForGameResponse] => [200, {
      response: {
        result: 1,
        leaderboards: [
          {
            id: mapping.steamworksLeaderboardId,
            name: 'Quickest Win',
            entries: 0,
            sortmethod: 'Ascending',
            displaytype: 'Numeric',
            onlytrustedwrites: false,
            onlyfriendsreads: false
          }
        ]
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2?appid=${integration.getConfig().appId}`).replyOnce(getLeaderboardsMock)

    const getEntriesMock = vi.fn((): [number, GetLeaderboardEntriesResponse] => [200, {
      leaderboardEntryInformation: {
        appID: 375290,
        leaderboardID: mapping.steamworksLeaderboardId,
        totalLeaderBoardEntryCount: 0,
        leaderboardEntries: []
      }
    }])
    axiosMock.onGet(`https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1?appid=${integration.getConfig().appId}&leaderboardid=${mapping.steamworksLeaderboardId}&rangestart=0&rangeend=1.7976931348623157e%2B308&datarequest=RequestGlobal`).replyOnce(getEntriesMock)

    const createMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    await syncSteamworksLeaderboards(em, integration)

    expect(getLeaderboardsMock).toHaveBeenCalledTimes(1)
    expect(getEntriesMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration }, { orderBy: { id: 'DESC' } })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=${entry.score}&scoremethod=KeepBest`,
      method: 'POST'
    })
  })
})
