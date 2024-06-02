import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken.js'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event.js'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../../../fixtures/IntegrationFactory.js'
import { IntegrationType } from '../../../../src/entities/integration.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'

describe('Game stats API service - put - steamworks integration', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterAll(async () => {
    axiosMock.reset()
  })

  it('should set a player stat in steamworks', async () => {
    const setMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game]).with(() => ({ maxChange: 99, maxValue: 3000 })).one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, stat, player])

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${stat.defaultValue + 10}`,
      method: 'POST'
    })
  })

  it('should not set a player stat if syncStats is false', async () => {
    const setMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game]).with(() => ({ maxChange: 99, maxValue: 3000 })).one()
    const player = await new PlayerFactory([apiKey.game]).state('with steam alias').one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, apiKey.game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, stat, player])

    await request(global.app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
