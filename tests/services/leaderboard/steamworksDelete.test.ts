import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../../fixtures/IntegrationFactory.js'
import { IntegrationType } from '../../../src/entities/integration.js'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event.js'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory.js'
import { UserType } from '../../../src/entities/user.js'

describe('Leaderboard service - delete - steamworks integration', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterAll(async () => {
    axiosMock.reset()
  })

  it('should delete a leaderboard in steamworks', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const deleteMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, leaderboard])

    await request(global.app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1',
      body: `appid=${config.appId}&name=${leaderboard.internalName}`,
      method: 'POST'
    })
  })

  it('should not delete a leaderboard in steamworks if syncLeaderboards is false', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const deleteMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush([integration, leaderboard])

    await request(global.app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>global.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
