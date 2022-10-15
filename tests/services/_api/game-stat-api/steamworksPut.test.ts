import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../../src/entities/integration'
import GameStatFactory from '../../../fixtures/GameStatFactory'

const baseUrl = '/v1/game-stats'

describe('Game stats API service - put - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should set a player stat in steamworks', async () => {
    const setMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game]).with(() => ({ maxChange: 99, maxValue: 3000 })).one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, stat, player])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${stat.defaultValue + 10}`,
      method: 'POST'
    })
  })

  it('should not set a player stat if syncStats is false', async () => {
    const setMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game]).with(() => ({ maxChange: 99, maxValue: 3000 })).one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, stat, player])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
