import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../src/entities/integration'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import SteamworksLeaderboardMapping from '../../../src/entities/steamworks-leaderboard-mapping'
import clearEntities from '../../utils/clearEntities'

describe('Leaderboard service - post - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['SteamworksLeaderboardMapping'])
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard in steamworks', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const createMock = jest.fn(() => [200, {
      result: {
        result: 1,
        leaderboard: {
          leaderBoardID: 12233213,
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

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    await request(app.callback())
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2',
      body: `appid=${config.appId}&name=highscores&sortmethod=Descending&displaytype=Numeric&createifnotfound=true&onlytrustedwrites=true&onlyfriendsreads=false`,
      method: 'POST'
    })

    const mapping = await (<EntityManager>app.context.em).getRepository(SteamworksLeaderboardMapping).findOne({
      steamworksLeaderboardId: 12233213
    }, { populate: ['leaderboard'] })

    expect(mapping.leaderboard.internalName).toBe('highscores')
  })

  it('should not create a leaderboard in steamworks if syncLeaderboards is false', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const createMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2').replyOnce(createMock)

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    await request(app.callback())
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    const mapping = await (<EntityManager>app.context.em).getRepository(SteamworksLeaderboardMapping).findOne({ steamworksLeaderboardId: 3242332 })
    expect(mapping).toBeNull()

    axiosMock.reset()
  })

  it('should not create a mapping if the leaderboard was not created in steamworks', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const createMock = jest.fn(() => [400, 'Required parameter \'appid\' is missing'])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2').replyOnce(createMock)

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    await request(app.callback())
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2',
      body: `appid=${config.appId}&name=highscores&sortmethod=Descending&displaytype=Numeric&createifnotfound=true&onlytrustedwrites=true&onlyfriendsreads=false`,
      method: 'POST'
    })

    const mappings = await (<EntityManager>app.context.em).getRepository(SteamworksLeaderboardMapping).findAll()
    expect(mappings).toHaveLength(0)
  })
})
