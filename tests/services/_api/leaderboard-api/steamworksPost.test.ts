import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import SteamworksLeaderboardMapping from '../../../../src/entities/steamworks-leaderboard-mapping'
import casual from 'casual'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../../src/entities/integration'

const baseUrl = '/v1/leaderboards'

describe('Leaderboard API service - post - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard entry in steamworks', async () => {
    const createMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).state('not unique').one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard, player, mapping])

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=300&scoremethod=KeepBest`,
      method: 'POST'
    })
  })

  it('should not create a leaderboard entry in steamworks if there is no mapping', async () => {
    const createMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).state('not unique').one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard, player])

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })

  it('should not create a leaderboard entry in steamworks if syncLeaderboards is false', async () => {
    const createMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).state('not unique').one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard, player])

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ aliasId: player.aliases[0].id, score: 300 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
