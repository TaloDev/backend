import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { IntegrationType } from '../../../../src/entities/integration'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Game stat API - steamworks update', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterAll(async () => {
    axiosMock.reset()
  })

  it('should set a player stat in steamworks', async () => {
    const setMock = vi.fn(() => [
      200,
      {
        result: {
          result: 1,
        },
      },
    ])
    axiosMock
      .onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1')
      .replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ maxChange: 99, maxValue: 3000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persistAndFlush([integration, stat, player])

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=${stat.defaultValue + 10}`,
      method: 'POST',
    })
  })

  it('should not set a player stat if syncStats is false', async () => {
    const setMock = vi.fn(() => [
      200,
      {
        result: {
          result: 1,
        },
      },
    ])
    axiosMock
      .onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1')
      .replyOnce(setMock)

    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])

    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ maxChange: 99, maxValue: 3000 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).withSteamAlias().one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncStats: false })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, apiKey.game, config)
      .one()
    await em.persistAndFlush([integration, stat, player])

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(setMock).not.toHaveBeenCalled()

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()
  })
})
