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
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import { LeaderboardSortMode } from '../../../src/entities/leaderboard'

describe('Leaderboard service - update leaderboard - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard in steamworks if it does not exist there', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const createMock = jest.fn(() => [200, {
      result: {
        result: 1,
        leaderboard: {
          leaderBoardID: 4654654,
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

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard])

    await request(app.callback())
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ sortMode: LeaderboardSortMode.ASC, internalName: leaderboard.internalName, name: leaderboard.name, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2',
      body: `appid=${config.appId}&name=${leaderboard.internalName}&sortmethod=Ascending&displaytype=Numeric&createifnotfound=true&onlytrustedwrites=true&onlyfriendsreads=false`,
      method: 'POST'
    })
  })

  it('should not create a leaderboard in steamworks if syncLeaderboards is false', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const createMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/FindOrCreateLeaderboard/v2').replyOnce(createMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard])

    await request(app.callback())
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ sortMode: LeaderboardSortMode.ASC, internalName: leaderboard.internalName, name: leaderboard.name, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
