import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import SteamworksLeaderboardMapping from '../../../../src/entities/steamworks-leaderboard-mapping'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../../src/entities/integration'
import { randNumber } from '@ngneat/falso'

describe('Leaderboard API service - post - steamworks integration', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterAll(async () => {
    axiosMock.reset()
  })

  it('should create a leaderboard entry in steamworks', async () => {
    const createMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).notUnique().one()
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, leaderboard, player, mapping])

    await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(createMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=300&scoremethod=KeepBest`,
      method: 'POST'
    })
  })

  it('should not create a leaderboard entry in steamworks if there is no mapping', async () => {
    const createMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).notUnique().one()
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, leaderboard, player])

    await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })

  it('should not create a leaderboard entry in steamworks if syncLeaderboards is false', async () => {
    const createMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(createMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])

    const leaderboard = await new LeaderboardFactory([apiKey.game]).notUnique().one()
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, leaderboard, player])

    await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(createMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
